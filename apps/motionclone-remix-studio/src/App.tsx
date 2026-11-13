import { CaptureFrame } from "./studio/CaptureFrame.tsx"
import { Studio } from "./studio/Studio.tsx"

export default function App() {
  const capture = new URLSearchParams(window.location.search).get("capture") === "1"
  return capture ? <CaptureFrame /> : <Studio />
}
