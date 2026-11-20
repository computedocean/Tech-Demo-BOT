import { AFFILIATION, FOOTER_LEAD, LICENSE_URL, PRODUCT_LIMIT, REPO_URL } from "@/lib/copy"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-sm text-muted-foreground">
        <p>
          {FOOTER_LEAD} {AFFILIATION} {PRODUCT_LIMIT}
        </p>
        <p>
          Inspired by{" "}
          <a className="underline underline-offset-2" href={REPO_URL}>
            Parallax
          </a>
          , which is{" "}
          <a className="underline underline-offset-2" href={LICENSE_URL}>
            MIT licensed
          </a>
          . This lab is an independent demo.
        </p>
      </div>
    </footer>
  )
}
