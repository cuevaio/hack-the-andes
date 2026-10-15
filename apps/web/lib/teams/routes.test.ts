import { expect, test } from "bun:test";

test("participant and organizer endpoints reject unauthenticated requests before database access", async () => {
  const source = `
    import assert from "node:assert/strict";
    import { mock } from "bun:test";
    import { HttpError } from "./lib/registration/http";
    mock.module("@/lib/auth", () => ({ requireAuthenticatedParticipant: async () => { throw new HttpError(401,"AUTHENTICATION_REQUIRED","Authentication failed"); } }));
    mock.module("@/lib/admin/auth", () => ({ requireAdminIdentity: async () => { throw new HttpError(403,"ADMIN_REQUIRED","Administrator access required"); } }));
    const participants = [
      ["./app/api/v1/team/route", ["GET", "POST"]],
      ["./app/api/v1/teams/route", ["GET"]],
      ["./app/api/v1/checkin/route", ["GET", "POST"]],
    ];
    for (const [path, methods] of participants) {
      const route = await import(path);
      for (const method of methods) {
        const response = await route[method](new Request("https://example.com/api/v1/team", { method }));
        assert.equal(response.status,401);
        assert.equal((await response.json()).error.code,"AUTHENTICATION_REQUIRED");
      }
    }
    for (const [path, methods] of [["./app/api/admin/teams/route",["GET","PATCH"]],["./app/api/admin/checkin/route",["POST"]]]) {
      const route = await import(path);
      for (const method of methods) {
        const response = await route[method](new Request("https://example.com/api/admin/teams", { method }));
        assert.equal(response.status,403);
      }
    }
    console.log("authorization passed");
  `;
  const child = Bun.spawn([process.execPath, "--eval", source], {
    cwd: new URL("../../", import.meta.url).pathname,
    env: { ...process.env, NEW_DATABASE_URL: "", CLERK_SECRET_KEY: "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stdout, stderr }).toEqual({
    code: 0,
    stdout: "authorization passed\n",
    stderr: "",
  });
});

test("actual routes and service integrate account-bound email invitations, QR verification and manual track selection", async () => {
  const source = `
    import assert from "node:assert/strict";
    import { mock } from "bun:test";
    import { readdir, readFile } from "node:fs/promises";
    import { PGlite } from "@electric-sql/pglite";
    import { drizzle } from "drizzle-orm/pglite";
    const client = new PGlite();
    for (const file of (await readdir("../../packages/db/drizzle")).filter(f=>f.endsWith(".sql")).sort()) await client.exec(await readFile("../../packages/db/drizzle/"+file,"utf8"));
    const database = drizzle(client);
    mock.module("@chofex/db", () => ({ db: database }));
    mock.module("@/lib/auth", () => ({ requireAuthenticatedParticipant: async request => ({ clerkUserId: request.headers.get("authorization"), tokenType: "oauth_token" }) }));
    mock.module("@/lib/admin/auth", () => ({ requireAdminIdentity: async () => ({ clerkUserId: "admin" }) }));
    let verified = true;
    mock.module("@clerk/nextjs/server", () => ({ clerkClient: async () => ({ users: { getUserList: async input => {
      assert.deepEqual(input.emailAddress,["friend@example.com"]);
      return { data: [{ id: "user-2", primaryEmailAddressId: "primary", emailAddresses: [{ id:"primary", emailAddress:"friend@example.com", verification:{ status: verified ? "verified" : "unverified" } }] }] };
    } } }) }));
    for (const n of [1,2]) {
      const person = (await client.query("insert into participants (clerk_user_id,name,legal_name) values ($1,$2,$2) returning id",["user-"+n,"Persona "+n])).rows[0];
      const app = (await client.query("insert into applications (participant_id,status,participation_mode,picture_url) values ($1,'accepted','in_person','https://example.com/photo.png') returning id",[person.id])).rows[0];
      await client.query("insert into acceptance_details (application_id,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone,shirt_size) values ($1,now(),'2000-01-01','encrypted','test','test','m')",[app.id]);
    }
    const team = await import("./app/api/v1/team/route");
    const checkin = await import("./app/api/v1/checkin/route");
    const desk = await import("./app/api/admin/checkin/route");
    const controls = await import("./app/api/admin/teams/route");
    const call = async (route, method, user, body) => {
      const init={method,headers:{ authorization:user,"content-type":"application/json" }};
      if (body !== undefined) init.body=JSON.stringify(body);
      const response = await route[method](new Request("https://example.com/api/test",init));
      return { status:response.status,...await response.json() };
    };
    const first = await call(team,"POST","user-1",{action:"create",name:"Cóndores"});
    assert.equal(first.status,200);
    const second = await call(team,"POST","user-2",{action:"create",name:"Solo"});
    verified=false;
    assert.equal((await call(team,"POST","user-1",{action:"invite",email:"friend@example.com"})).error.code,"INVITEE_NOT_ELIGIBLE");
    verified=true;
    assert.equal((await call(team,"POST","user-1",{action:"invite",email:" Friend@Example.com "})).status,200);
    const inbox = await call(team,"GET","user-2");
    const joined = await call(team,"POST","user-2",{action:"accept",invitationId:inbox.data.invitations[0].id,expectedTeamId:second.data.team.id});
    assert.equal(joined.data.team.id,first.data.team.id);
    assert.equal(joined.data.team.members.length,2);
    assert.equal((await client.query("select * from teams")).rows.length,1);
    const invalid = await call(team,"POST","user-1",{action:"settings",selectionOpen:true});
    assert.equal(invalid.status,422);
    assert.equal((await client.query("select selection_open from hackathon_settings")).rows[0].selection_open,false);
    for (const user of ["user-1","user-2"]) {
      const qr = await call(checkin,"POST",user);
      assert.equal(qr.data.checkedIn,false);
      assert.match(qr.data.token,/^[a-f0-9]{32}$/);
      const stored = (await client.query("select token_hash from checkin_tokens order by expires_at desc limit 1")).rows[0];
      assert.notEqual(stored.token_hash,qr.data.token);
      const preview = await call(desk,"POST","admin",{token:qr.data.token.toUpperCase().match(/.{4}/g).join("-"),confirm:false});
      assert.equal(preview.data.checkedIn,false);
      assert.equal((await call(checkin,"GET",user)).data.checkedIn,false);
      assert.equal((await call(desk,"POST","admin",{token:qr.data.token,confirm:true})).data.checkedIn,true);
      assert.equal((await call(checkin,"GET",user)).data.checkedIn,true);
    }
    const track = {action:"track",track:"security",expectedTeamId:first.data.team.id};
    assert.equal((await call(team,"POST","user-1",track)).error.code,"TRACK_SELECTION_CLOSED");
    assert.equal((await call(controls,"PATCH","admin",{selectionOpen:true})).data.selectionOpen,true);
    assert.equal((await call(team,"POST","user-2",track)).data.team.track,"security");
    assert.equal((await call(controls,"PATCH","admin",{selectionOpen:false})).data.selectionOpen,false);
    assert.equal((await call(team,"POST","user-1",{...track,track:"transport"})).error.code,"TRACK_SELECTION_CLOSED");
    await client.close();
    console.log("integration passed");
  `;
  const child = Bun.spawn([process.execPath, "--eval", source], {
    cwd: new URL("../../", import.meta.url).pathname,
    env: { ...process.env, NEW_DATABASE_URL: "", CLERK_SECRET_KEY: "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stdout, stderr }).toEqual({
    code: 0,
    stdout: "integration passed\n",
    stderr: "",
  });
});
