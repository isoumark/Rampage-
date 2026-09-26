import * as THREE from 'three'

function findBone(root, ...tokens) {
  let result = null
  root.traverse((child) => {
    if (result || !child.isBone) return
    const name = child.name.toLowerCase().replace(/[^a-z]/g, '')
    if (tokens.some((token) => name.includes(token))) result = child
  })
  return result
}

export function findWeaponHand(root) {
  let hand = null
  root?.traverse((child) => {
    if (hand || !child.isBone) return
    const name = child.name.toLowerCase().replace(/[^a-z]/g, '')
    if (name.endsWith('righthand')) hand = child
  })
  return hand
}

export function alignWeaponMount(root, hand, mount, target = new THREE.Vector3()) {
  if (!root || !hand || !mount) return false
  root.updateWorldMatrix(true, true)
  hand.getWorldPosition(target)
  root.worldToLocal(target)
  mount.position.copy(target)
  return true
}

export function createWeaponHoldAction(root, mixer) {
  const pose = [
    [findBone(root, 'leftupperarm', 'leftarm'), [-0.72, -0.12, 1.12]],
    [findBone(root, 'leftforearm', 'leftlowerarm'), [-0.82, 0.08, 0.18]],
    [findBone(root, 'rightupperarm', 'rightarm'), [-0.78, 0.11, -1.12]],
    [findBone(root, 'rightforearm', 'rightlowerarm'), [-0.86, -0.07, -0.17]],
    [findBone(root, 'spine2', 'spine1'), [-0.035, 0, 0]],
  ].filter(([bone]) => bone)

  const tracks = pose.map(([bone, rotation]) => {
    const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'XYZ'))
    const quaternion = bone.quaternion.clone().multiply(offset)
    return new THREE.QuaternionKeyframeTrack(
      `${bone.name}.quaternion`,
      [0, 1],
      [quaternion.x, quaternion.y, quaternion.z, quaternion.w, quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    )
  })
  if (!tracks.length) return null

  const clip = new THREE.AnimationClip('RifleHold', 1, tracks)
  const action = mixer.clipAction(clip)
  action.enabled = true
  action.setEffectiveWeight(1)
  action.play()
  return action
}

export function removeWeaponArmTracks(clip) {
  const armBones = ['leftarm', 'leftforearm', 'leftlowerarm', 'rightarm', 'rightforearm', 'rightlowerarm']
  const filtered = clip.clone()
  filtered.tracks = filtered.tracks.filter((track) => {
    const name = track.name.toLowerCase().replace(/[^a-z]/g, '')
    return !armBones.some((bone) => name.includes(bone))
  })
  return filtered
}
