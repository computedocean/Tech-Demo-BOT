import browserSession from "../../fixtures/browser-example-session.txt?raw"
import draftPreview from "../../fixtures/gmail-draft-preview.txt?raw"
import missingLogin from "../../fixtures/gmail-missing-login.txt?raw"
import linearIssues from "../../fixtures/linear-issues.txt?raw"
import outlookPreview from "../../fixtures/outlook-calendar-preview.txt?raw"

export const transcripts = {
  browserSession: browserSession.trimEnd(),
  draftPreview: draftPreview.trimEnd(),
  missingLogin: missingLogin.trimEnd(),
  linearIssues: linearIssues.trimEnd(),
  outlookPreview: outlookPreview.trimEnd(),
}
