import * as THREE from 'three'

const boneKey = (name) => name.split(/[|:]/).pop().replace(/^mixamorig[_-]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase()

// Transfer world-space motion relative to each rig's reference pose. Renaming
// tracks alone is insufficient for FBX files with different bone axes.
export function retargetAnimation(source, target, clip) {
  source.updateMatrixWorld(true)
  target.updateMatrixWorld(true)
  const sources = new Map()
  source.traverse((bone) => {
    if (bone.isBone) sources.set(boneKey(bone.name), {
      bone, inverseBind: bone.getWorldQuaternion(new THREE.Quaternion()).invert(),
    })
  })
  const bindings = []
  target.traverse((bone) => {
    if (!bone.isBone) return
    const match = sources.get(boneKey(bone.name))
    bindings.push({ bone, match, bind: bone.getWorldQuaternion(new THREE.Quaternion()), values: [] })
  })
  if (bindings.filter((entry) => entry.match).length < 8) throw new Error('Incompatible animation skeleton')
  const hips = bindings.find((entry) => boneKey(entry.bone.name) === 'hips')
  const sourceHips = hips?.match?.bone
  const sourceHeight = sourceHips?.position.y || 1
  const ratio = hips ? hips.bone.position.y / sourceHeight : 1
  const mixer = new THREE.AnimationMixer(source)
  mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play()
  const frames = Math.ceil(clip.duration * 30)
  const times = []
  const positions = []
  const worlds = new Map()
  for (let frame = 0; frame <= frames; frame += 1) {
    const time = Math.min(frame / frames * clip.duration, clip.duration - 0.00001)
    times.push(frame / frames * clip.duration)
    mixer.setTime(time)
    source.updateMatrixWorld(true)
    worlds.clear()
    for (const entry of bindings) {
      const parentWorld = worlds.get(entry.bone.parent) ?? entry.bone.parent.getWorldQuaternion(new THREE.Quaternion())
      const world = entry.match
        ? entry.match.bone.getWorldQuaternion(new THREE.Quaternion()).multiply(entry.match.inverseBind).multiply(entry.bind)
        : parentWorld.clone().multiply(entry.bone.quaternion)
      worlds.set(entry.bone, world)
      const local = parentWorld.clone().invert().multiply(world).normalize()
      entry.values.push(...local.toArray())
    }
    if (hips && sourceHips) positions.push(hips.bone.position.x, sourceHips.position.y * ratio, hips.bone.position.z)
  }
  mixer.stopAllAction()
  mixer.uncacheRoot(source)
  const tracks = bindings.filter((entry) => entry.match).map((entry) => {
    // Close the loop to avoid a visible snap at wraparound.
    entry.values.splice(entry.values.length - 4, 4, ...entry.values.slice(0, 4))
    return new THREE.QuaternionKeyframeTrack(`${entry.bone.name}.quaternion`, times, entry.values)
  })
  if (positions.length) {
    positions.splice(positions.length - 3, 3, ...positions.slice(0, 3))
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.bone.name}.position`, times, positions))
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}
