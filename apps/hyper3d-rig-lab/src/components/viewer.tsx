import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type ViewerProps = {
  url: string | null
  label: string
  clip: string
  clips: string[]
  playing: boolean
  showBones: boolean
  resetKey: number
  onClips: (clips: string[]) => void
  onClip: (clip: string) => void
  onPlaying: (playing: boolean) => void
  onShowBones: (show: boolean) => void
  onReset: () => void
}

export function Viewer(props: ViewerProps) {
  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">{props.label}</p>
          <p className="text-xs text-muted-foreground">Drag to orbit. Scroll to zoom.</p>
        </div>
      </div>
      <div className="relative h-[28rem] bg-[oklch(0.97_0_0)]">
        {props.url ? (
          <ViewerError resetKey={props.url}>
            <Canvas camera={{ position: [1.8, 1.15, 2.7], fov: 35 }} dpr={[1, 2]}>
              <color attach="background" args={["#f5f5f4"]} />
              <ambientLight intensity={0.75} />
              <directionalLight position={[3, 5, 2]} intensity={1.5} />
              <directionalLight position={[-2, 2, -2]} intensity={0.35} />
              <gridHelper args={[4, 8, "#d6d3d1", "#e7e5e4"]} />
              <Suspense fallback={null}>
                <RiggedModel
                  url={props.url}
                  clip={props.clip}
                  playing={props.playing}
                  showBones={props.showBones}
                  resetKey={props.resetKey}
                  onClips={props.onClips}
                />
              </Suspense>
              <OrbitControls makeDefault enableDamping target={[0, 0.9, 0]} />
            </Canvas>
          </ViewerError>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Drop a GLB to preview the unrigged mesh.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <Button type="button" size="sm" variant="outline" onClick={() => props.onPlaying(true)} disabled={!props.clip}>
          Play
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => props.onPlaying(false)} disabled={!props.clip}>
          Pause
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={props.onReset} disabled={!props.clip}>
          Reset
        </Button>
        <Label htmlFor="clip-switcher" className="ml-1 text-xs text-muted-foreground">
          Clip
        </Label>
        <select
          id="clip-switcher"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={props.clip}
          disabled={props.clips.length === 0}
          onChange={(event) => props.onClip(event.target.value)}
        >
          {props.clips.length === 0 ? <option value="">No clips</option> : null}
          {props.clips.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="bone-overlay">Bones</Label>
          <Switch id="bone-overlay" checked={props.showBones} onCheckedChange={props.onShowBones} />
        </div>
      </div>
    </div>
  )
}

function RiggedModel({
  url,
  clip,
  playing,
  showBones,
  resetKey,
  onClips,
}: {
  url: string
  clip: string
  playing: boolean
  showBones: boolean
  resetKey: number
  onClips: (clips: string[]) => void
}) {
  const gltf = useGLTF(url)
  const { actions, names } = useAnimations(gltf.animations, gltf.scene)
  const helper = useMemo(() => {
    const next = new THREE.SkeletonHelper(gltf.scene)
    if (next.bones.length === 0) {
      next.dispose()
      return null
    }
    next.setColors(new THREE.Color("#c2410c"), new THREE.Color("#1c1917"))
    next.matrix = new THREE.Matrix4()
    next.matrixAutoUpdate = false
    next.frustumCulled = false
    next.renderOrder = 10
    const material = next.material as THREE.LineBasicMaterial
    material.depthTest = false
    material.depthWrite = false
    return next
  }, [gltf.scene])

  useEffect(() => {
    onClips(names)
  }, [names, onClips])

  useEffect(() => {
    return () => {
      useGLTF.clear(url)
    }
  }, [url])

  useEffect(() => {
    for (const name of names) {
      const action = actions[name]
      if (!action) continue
      if (name !== clip) action.stop()
    }
    const action = clip ? actions[clip] : null
    if (!action) return
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.enabled = true
    action.paused = !playing
    action.play()
  }, [actions, clip, names])

  useEffect(() => {
    const action = clip ? actions[clip] : null
    if (!action) return
    action.paused = !playing
    if (playing && !action.isRunning()) action.play()
  }, [actions, clip, playing])

  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const action = clip ? actions[clip] : null
    if (!action) return
    action.time = 0
    action.paused = !playingRef.current
  }, [resetKey, actions, clip])

  useFrame(() => {
    if (!helper) return
    helper.visible = showBones
    helper.matrixAutoUpdate = false
    helper.matrix.copy(gltf.scene.matrixWorld)
    helper.updateMatrixWorld(true)
  })

  return (
    <>
      <primitive object={gltf.scene} />
      {helper ? <primitive object={helper} /> : null}
    </>
  )
}

class ViewerError extends Component<{ children: ReactNode; resetKey: string }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "Could not read this GLB." }
  }

  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.message) {
      this.setState({ message: null })
    }
  }

  render() {
    if (this.state.message) {
      return <p className="flex h-full items-center justify-center px-6 text-sm text-destructive">Could not read this GLB.</p>
    }
    return this.props.children
  }
}
