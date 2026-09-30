export const agentApplicationPrompt = (applicationUrl: string) =>
  `Help me apply to Hack the Andes in Lima using the andes CLI.

First install the Hack the Andes application skill globally when supported:
npx skills add https://github.com/crafter-station/hack-the-andes --skill chofex-hackathon -g -y

If the andes CLI is missing, proactively run curl -fsSL https://hacktheandes.com/install | bash yourself and add $HOME/.chofex/bin to PATH for subsequent commands before continuing. Then use the chofex-hackathon skill with the andes command to apply on my behalf through ${applicationUrl}. Ask me for every answer, never invent personal information or consent, show me the completed application, and get my explicit approval immediately before submitting it. I will complete browser authentication myself. After applying, check my status and explain my next steps.`;
