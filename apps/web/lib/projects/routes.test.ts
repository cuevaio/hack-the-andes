import { expect, test } from "bun:test";

test("participant and organizer endpoints reject unauthenticated requests before database access", async () => {
  const source = `
    import assert from "node:assert/strict";
    import { mock } from "bun:test";
    import { HttpError } from "./lib/registration/http";
    mock.module("@/lib/auth", () => ({ requireAuthenticatedParticipant: async () => { throw new HttpError(401,"AUTHENTICATION_REQUIRED","Authentication failed"); } }));
    mock.module("@/lib/admin/auth", () => ({ requireAdminIdentity: async () => { throw new HttpError(403,"ADMIN_REQUIRED","Administrator access required"); } }));
    const participants = [
      ["./app/api/v1/project/route", ["GET", "POST"]],
    ];
    for (const [path, methods] of participants) {
      const route = await import(path);
      for (const method of methods) {
        const response = await route[method](new Request("https://example.com/api/v1/team", { method }));
        assert.equal(response.status,401);
        assert.equal((await response.json()).error.code,"AUTHENTICATION_REQUIRED");
      }
    }
    for (const [path, methods] of [["./app/api/admin/projects/route",["GET","PATCH"]]]) {
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

test("project routes enforce membership, validate URLs, and gate public reads while organizers retain history", async () => {
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
    const project = await import("./app/api/v1/project/route");
    const controls = await import("./app/api/admin/projects/route");
    const service = await import("./lib/projects/service");
    const call = async (route, method, user, body) => {
      const init={method,headers:{ authorization:user,"content-type":"application/json" }};
      if (body !== undefined) init.body=JSON.stringify(body);
      const response = await route[method](new Request("https://example.com/api/test",init));
      return { status:response.status,...await response.json() };
    };
    const created = await call(team,"POST","user-1",{action:"create",name:"Cóndores"});
    const expectedTeamId=created.data.team.id;
    assert.equal((await call(project,"GET","user-2")).data.project,null);
    assert.equal((await call(project,"POST","user-2",{action:"update",expectedTeamId,body:"No soy integrante"})).error.code,"TEAM_REQUIRED");
    const update = await call(project,"POST","user-1",{action:"update",expectedTeamId,body:"Elegimos transporte"});
    assert.equal(update.data.update.body,"Elegimos transporte");
    assert.equal(update.data.updateCount,1);
    assert.equal(update.data.project,undefined);
    const compact=await project.GET(new Request("https://example.com/api/v1/project?history=false",{headers:{authorization:"user-1"}}));
    const summary=(await compact.json()).data.project;
    assert.equal(summary.updateCount,1);
    assert.deepEqual(summary.updates,[]);
    const renamed=await call(team,"POST","user-1",{action:"rename",expectedTeamId,name:"Cóndores nuevos"});
    assert.equal(renamed.data.team.name,"Cóndores nuevos");
    assert.equal((await call(team,"POST","user-1",{action:"rename",expectedTeamId:"00000000-0000-4000-8000-000000000099",name:"Obsoleto"})).error.code,"TEAM_CHANGED");
    const data={action:"submit",expectedTeamId,expectedUpdatedAt:null,deploymentUrl:"https://demo.example.com",presentationUrl:"https://slides.example.com",githubUrl:"https://github.com/example/project",description:"# Proyecto"};
    for (const githubUrl of [undefined, "", "https://github.com/example", "https://gitlab.com/example/project", "https://github.com/example/project/issues", "https://github.com.evil.test/example/project", "http://github.com/example/project", "https://github.com/example/project?token=secret"]) {
      const invalidGithub=await call(project,"POST","user-1",{...data,githubUrl});
      assert.equal(invalidGithub.status,422);
      assert(invalidGithub.error.details.issues.some(issue=>issue.field==="githubUrl"));
    }
    const submitted=await call(project,"POST","user-1",data);
    assert.equal(submitted.status,200);
    assert.equal(submitted.data.project.submission.githubUrl,data.githubUrl);
    assert.equal(submitted.data.project.updateCount,1);
    assert.deepEqual(submitted.data.project.updates,[]);
    assert.equal((await call(project,"POST","user-1",{...data,deploymentUrl:"https://user:secret@site.example.com"})).status,422);
    const invalid=await call(project,"POST","user-1",{...data,deploymentUrl:"https://site:abc"});
    assert.equal(invalid.status,422);
    assert(invalid.error.details.issues.some(issue=>issue.field==="deploymentUrl"));
    assert(invalid.error.details.issues.some(issue=>issue.reason.includes("HTTP")));
    assert.equal((await call(project,"GET","user-1")).data.project.updates.length,1);
    assert.equal(await service.getPublicProject(expectedTeamId),null);
    assert.equal(await service.getPublicProject("invalid-id"),null);
    const dashboard=await call(controls,"GET","admin");
    assert.equal(dashboard.data.projects.length,1);
    assert.equal(dashboard.data.projects[0].updates[0].body,"Elegimos transporte");
    assert.equal((await service.getProjectGallery()).visible,false);
    assert.equal((await call(controls,"PATCH","admin",{galleryVisible:true})).status,200);
    assert.equal((await service.getPublicProject(expectedTeamId)).submission.description,"# Proyecto");
    assert.equal((await service.getProjectGallery()).projects.length,1);
    assert.equal((await call(controls,"PATCH","admin",{galleryVisible:false})).status,200);
    assert.equal(await service.getPublicProject(expectedTeamId),null);
    assert.equal((await service.getProjectGallery()).projects.length,0);
    await call(team,"POST","user-1",{action:"leave",expectedTeamId});
    const archive=await call(controls,"GET","admin");
    assert.equal(archive.data.projects.length,0);
    assert.equal(archive.data.archives[0].project.teamName,"Cóndores nuevos");
    assert.equal(archive.data.archives[0].project.updates[0].body,"Elegimos transporte");
    assert.equal(archive.data.archives[0].project.submission.description,"# Proyecto");
    assert.equal(await service.getPublicProject(expectedTeamId),null);
    await client.close();
    console.log("project integration passed");
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
    stdout: "project integration passed\n",
    stderr: "",
  });
});
