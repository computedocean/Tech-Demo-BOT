/**
 * Authors the mock-mode sample meshes.
 * These figures are original geometry for this demo (MIT). They are not Deemos or Hyper3D assets.
 */
import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Document, NodeIO, type Node as GltfNode } from "@gltf-transform/core"

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

type BoneDef = {
  name: string
  parent: string | null
  local: Vec3
}

const BONES: BoneDef[] = [
  { name: "Hips", parent: null, local: [0, 0.9, 0] },
  { name: "Spine", parent: "Hips", local: [0, 0.14, 0] },
  { name: "Chest", parent: "Spine", local: [0, 0.18, 0] },
  { name: "Neck", parent: "Chest", local: [0, 0.2, 0] },
  { name: "Head", parent: "Neck", local: [0, 0.12, 0] },
  { name: "LeftUpperArm", parent: "Chest", local: [0.2, 0.08, 0] },
  { name: "LeftLowerArm", parent: "LeftUpperArm", local: [0, -0.28, 0] },
  { name: "LeftHand", parent: "LeftLowerArm", local: [0, -0.26, 0] },
  { name: "RightUpperArm", parent: "Chest", local: [-0.2, 0.08, 0] },
  { name: "RightLowerArm", parent: "RightUpperArm", local: [0, -0.28, 0] },
  { name: "RightHand", parent: "RightLowerArm", local: [0, -0.26, 0] },
  { name: "LeftUpperLeg", parent: "Hips", local: [0.1, -0.06, 0] },
  { name: "LeftLowerLeg", parent: "LeftUpperLeg", local: [0, -0.42, 0] },
  { name: "LeftFoot", parent: "LeftLowerLeg", local: [0, -0.4, 0] },
  { name: "RightUpperLeg", parent: "Hips", local: [-0.1, -0.06, 0] },
  { name: "RightLowerLeg", parent: "RightUpperLeg", local: [0, -0.42, 0] },
  { name: "RightFoot", parent: "RightLowerLeg", local: [0, -0.4, 0] },
]

type Geometry = {
  positions: number[]
  normals: number[]
  indices: number[]
  joints: number[]
  weights: number[]
}

const rootDir = fileURLToPath(new URL("..", import.meta.url))
const outDir = join(rootDir, "public", "samples")

function axisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2
  const s = Math.sin(half)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
}

function worldPositions(): Map<string, Vec3> {
  const locals = new Map(BONES.map((bone) => [bone.name, bone]))
  const worlds = new Map<string, Vec3>()
  const visit = (name: string): Vec3 => {
    const cached = worlds.get(name)
    if (cached) return cached
    const bone = locals.get(name)
    if (!bone) throw new Error(`Missing bone ${name}`)
    if (!bone.parent) {
      worlds.set(name, bone.local)
      return bone.local
    }
    const parent = visit(bone.parent)
    const world: Vec3 = [
      parent[0] + bone.local[0],
      parent[1] + bone.local[1],
      parent[2] + bone.local[2],
    ]
    worlds.set(name, world)
    return world
  }
  for (const bone of BONES) visit(bone.name)
  return worlds
}

function appendBox(geo: Geometry, center: Vec3, size: Vec3, joint: number) {
  const [cx, cy, cz] = center
  const hx = size[0] / 2
  const hy = size[1] / 2
  const hz = size[2] / 2
  const faces: { n: Vec3; verts: Vec3[] }[] = [
    { n: [1, 0, 0], verts: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]] },
    { n: [-1, 0, 0], verts: [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]] },
    { n: [0, 1, 0], verts: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, -1, 0], verts: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] },
    { n: [0, 0, 1], verts: [[1, -1, 1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1]] },
    { n: [0, 0, -1], verts: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]] },
  ]
  for (const face of faces) {
    const start = geo.positions.length / 3
    for (const vertex of face.verts) {
      geo.positions.push(cx + vertex[0] * hx, cy + vertex[1] * hy, cz + vertex[2] * hz)
      geo.normals.push(...face.n)
      geo.joints.push(joint, 0, 0, 0)
      geo.weights.push(1, 0, 0, 0)
    }
    geo.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
}

function segmentBox(from: Vec3, to: Vec3, thickness: number, widenX = 0): { center: Vec3; size: Vec3 } {
  const center: Vec3 = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ]
  const size: Vec3 = [
    Math.max(thickness, Math.abs(to[0] - from[0])) + widenX,
    Math.max(thickness, Math.abs(to[1] - from[1])),
    Math.max(thickness, Math.abs(to[2] - from[2])),
  ]
  return { center, size }
}

function buildGeometry(): { geo: Geometry; jointNames: string[] } {
  const worlds = worldPositions()
  const jointNames = BONES.map((bone) => bone.name)
  const index = new Map(jointNames.map((name, i) => [name, i]))
  const geo: Geometry = { positions: [], normals: [], indices: [], joints: [], weights: [] }
  const at = (name: string) => {
    const point = worlds.get(name)
    if (!point) throw new Error(`Missing world position for ${name}`)
    return point
  }
  const joint = (name: string) => {
    const id = index.get(name)
    if (id == null) throw new Error(`Missing joint ${name}`)
    return id
  }
  const addSegment = (name: string, from: string, to: string, thickness: number, widenX = 0) => {
    const box = segmentBox(at(from), at(to), thickness, widenX)
    appendBox(geo, box.center, box.size, joint(name))
  }

  appendBox(geo, at("Hips"), [0.28, 0.16, 0.18], joint("Hips"))
  addSegment("Spine", "Spine", "Chest", 0.16, 0.06)
  addSegment("Chest", "Chest", "Neck", 0.18, 0.16)
  addSegment("Neck", "Neck", "Head", 0.14)
  const head = at("Head")
  appendBox(geo, [head[0], head[1] + 0.08, head[2]], [0.2, 0.24, 0.2], joint("Head"))

  for (const side of ["Left", "Right"] as const) {
    addSegment(`${side}UpperArm`, `${side}UpperArm`, `${side}LowerArm`, 0.08)
    addSegment(`${side}LowerArm`, `${side}LowerArm`, `${side}Hand`, 0.07)
    const hand = at(`${side}Hand`)
    appendBox(geo, [hand[0], hand[1] - 0.06, hand[2]], [0.08, 0.12, 0.05], joint(`${side}Hand`))
    addSegment(`${side}UpperLeg`, `${side}UpperLeg`, `${side}LowerLeg`, 0.12)
    addSegment(`${side}LowerLeg`, `${side}LowerLeg`, `${side}Foot`, 0.1)
    const foot = at(`${side}Foot`)
    appendBox(geo, [foot[0], foot[1] - 0.02, foot[2] + 0.05], [0.1, 0.06, 0.18], joint(`${side}Foot`))
  }

  return { geo, jointNames }
}

function inverseTranslation(point: Vec3): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -point[0], -point[1], -point[2], 1]
}

function stamp(document: Document) {
  const asset = document.getRoot().getAsset()
  asset.generator = "hyper3d-rig-lab sample builder"
  asset.copyright = "Copyright 2026 Tech Demo contributors. MIT License."
}

async function writeGlb(document: Document, filename: string) {
  const io = new NodeIO()
  const bytes = await io.writeBinary(document)
  await Bun.write(join(outDir, filename), bytes)
}

function accessor(document: Document, buffer: ReturnType<Document["createBuffer"]>, type: "SCALAR" | "VEC3" | "VEC4" | "MAT4", array: Float32Array | Uint16Array) {
  return document.createAccessor().setType(type).setArray(array).setBuffer(buffer)
}

function buildUnrigged(geo: Geometry) {
  const document = new Document()
  stamp(document)
  const buffer = document.createBuffer("unrigged")
  const material = document
    .createMaterial("Clay")
    .setBaseColorFactor([0.8, 0.76, 0.7, 1])
    .setRoughnessFactor(0.78)
    .setMetallicFactor(0)
    .setDoubleSided(true)
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", accessor(document, buffer, "VEC3", new Float32Array(geo.positions)))
    .setAttribute("NORMAL", accessor(document, buffer, "VEC3", new Float32Array(geo.normals)))
    .setIndices(accessor(document, buffer, "SCALAR", new Uint16Array(geo.indices)))
    .setMaterial(material)
  const mesh = document.createMesh("UnriggedFigure").addPrimitive(primitive)
  const node = document.createNode("UnriggedFigure").setMesh(mesh)
  const scene = document.createScene("Scene")
  scene.addChild(node)
  document.getRoot().setDefaultScene(scene)
  return document
}

function addRotationClip(
  document: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  name: string,
  times: number[],
  tracks: { node: GltfNode; values: Quat[] }[],
) {
  const animation = document.createAnimation(name)
  const input = accessor(document, buffer, "SCALAR", new Float32Array(times))
  for (const track of tracks) {
    const output = accessor(document, buffer, "VEC4", new Float32Array(track.values.flat()))
    const sampler = document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR")
    const channel = document
      .createAnimationChannel(`${name}-${track.node.getName()}`)
      .setTargetNode(track.node)
      .setTargetPath("rotation")
      .setSampler(sampler)
    animation.addSampler(sampler).addChannel(channel)
  }
  const hips = tracks.find((track) => track.node.getName() === "Hips")
  if (name === "Walk" && hips) {
    const bob = accessor(
      document,
      buffer,
      "VEC3",
      new Float32Array([
        0, 0.9, 0,
        0, 0.94, 0,
        0, 0.9, 0,
        0, 0.94, 0,
        0, 0.9, 0,
      ]),
    )
    const sampler = document.createAnimationSampler().setInput(input).setOutput(bob).setInterpolation("LINEAR")
    const channel = document
      .createAnimationChannel("Walk-Hips-translation")
      .setTargetNode(hips.node)
      .setTargetPath("translation")
      .setSampler(sampler)
    animation.addSampler(sampler).addChannel(channel)
  }
}

function buildRigged(geo: Geometry, jointNames: string[]) {
  const document = new Document()
  stamp(document)
  const buffer = document.createBuffer("rigged")
  const material = document
    .createMaterial("Clay")
    .setBaseColorFactor([0.8, 0.76, 0.7, 1])
    .setRoughnessFactor(0.78)
    .setMetallicFactor(0)
    .setDoubleSided(true)
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", accessor(document, buffer, "VEC3", new Float32Array(geo.positions)))
    .setAttribute("NORMAL", accessor(document, buffer, "VEC3", new Float32Array(geo.normals)))
    .setAttribute("JOINTS_0", accessor(document, buffer, "VEC4", new Uint16Array(geo.joints)))
    .setAttribute("WEIGHTS_0", accessor(document, buffer, "VEC4", new Float32Array(geo.weights)))
    .setIndices(accessor(document, buffer, "SCALAR", new Uint16Array(geo.indices)))
    .setMaterial(material)
  const mesh = document.createMesh("RiggedFigure").addPrimitive(primitive)

  const nodes = new Map<string, GltfNode>()
  for (const bone of BONES) {
    nodes.set(bone.name, document.createNode(bone.name).setTranslation(bone.local))
  }
  for (const bone of BONES) {
    if (!bone.parent) continue
    nodes.get(bone.parent)?.addChild(nodes.get(bone.name)!)
  }
  const armature = document.createNode("Armature")
  armature.addChild(nodes.get("Hips")!)

  const worlds = worldPositions()
  const inverse = new Float32Array(jointNames.length * 16)
  jointNames.forEach((name, index) => {
    inverse.set(inverseTranslation(worlds.get(name)!), index * 16)
  })
  const skin = document.createSkin("FigureSkin").setSkeleton(armature)
  for (const name of jointNames) skin.addJoint(nodes.get(name)!)
  skin.setInverseBindMatrices(accessor(document, buffer, "MAT4", inverse))

  const meshNode = document.createNode("RiggedFigure").setMesh(mesh).setSkin(skin)
  const scene = document.createScene("Scene")
  scene.addChild(armature)
  scene.addChild(meshNode)
  document.getRoot().setDefaultScene(scene)

  const node = (name: string) => nodes.get(name)!
  const qx = (angle: number) => axisAngle([1, 0, 0], angle)
  const qz = (angle: number) => axisAngle([0, 0, 1], angle)
  const walkTimes = [0, 0.3, 0.6, 0.9, 1.2]
  addRotationClip(document, buffer, "Walk", walkTimes, [
    { node: node("LeftUpperLeg"), values: [-0.6, 0, 0.6, 0, -0.6].map(qx) },
    { node: node("RightUpperLeg"), values: [0.6, 0, -0.6, 0, 0.6].map(qx) },
    { node: node("LeftLowerLeg"), values: [0.15, 0.55, 0.15, 0.08, 0.15].map(qx) },
    { node: node("RightLowerLeg"), values: [0.15, 0.08, 0.15, 0.55, 0.15].map(qx) },
    { node: node("LeftUpperArm"), values: [0.45, 0, -0.45, 0, 0.45].map(qx) },
    { node: node("RightUpperArm"), values: [-0.45, 0, 0.45, 0, -0.45].map(qx) },
    { node: node("Hips"), values: [0, 0, 0, 0, 0].map(qx) },
  ])
  const idleTimes = [0, 1, 2]
  addRotationClip(document, buffer, "Idle", idleTimes, [
    { node: node("Spine"), values: [0.02, 0.08, 0.02].map(qx) },
    { node: node("Chest"), values: [0.01, 0.05, 0.01].map(qx) },
  ])
  const waveTimes = [0, 0.4, 0.8, 1.2, 1.6]
  addRotationClip(document, buffer, "Wave", waveTimes, [
    { node: node("RightUpperArm"), values: [-0.2, -1.35, -1.15, -1.35, -0.2].map(qz) },
    { node: node("RightLowerArm"), values: [0.2, 0.9, 0.35, 0.95, 0.2].map(qx) },
  ])
  return document
}

const { geo, jointNames } = buildGeometry()
await mkdir(outDir, { recursive: true })
await writeGlb(buildUnrigged(geo), "unrigged-figure.glb")
await writeGlb(buildRigged(geo, jointNames), "rigged-figure.glb")
console.log(`Wrote sample GLBs to ${dirname(join(outDir, "rigged-figure.glb"))}`)
