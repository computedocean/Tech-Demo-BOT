export function DeskFooter({ imported }: { imported: boolean }) {
  return (
    <footer className="border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      Independent demo. Simulated only. This is not the official Pathwarden product and is not affiliated with
      Pathwarden or MarbaSec. It does not scan or attack any network.{" "}
      <a
        className="underline underline-offset-2"
        href="https://github.com/marbas207/Pathwarden"
        target="_blank"
        rel="noreferrer"
      >
        Pathwarden
      </a>{" "}
      is Apache-2.0. This desk is an original TypeScript model of path walk, ranking, minimum cut, and scan diffs. No
      Pathwarden source is copied.{" "}
      {imported
        ? "The graph is a simulation on the file you provided."
        : "The directory is synthetic Northglass Analytical."}{" "}
      <span className="text-foreground/80">
        Import reads a local BloodHound CE JSON file (meta.version 5 or 6, data array, at most 40 objects and 256 KB):
        ObjectIdentifier, Properties.name, domain, highvalue, group Members, computer sessions, local admins, and ACE
        rights GenericAll, GenericWrite, DCSync, AddMember, and AdminTo.
      </span>
    </footer>
  );
}
