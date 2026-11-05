import { Composition } from "remotion";
import { BookmarkCard } from "./BookmarkCard";
import { defaultProps } from "./defaults";
export const Root = () => (
  <Composition id="BookmarkCard" component={BookmarkCard} durationInFrames={150} fps={30} width={1080} height={1080} defaultProps={defaultProps} />
);
