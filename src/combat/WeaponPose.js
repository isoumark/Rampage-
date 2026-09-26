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

export function createWeaponHoldAction(root, mixer) {
  const pose = [
    [findBone(root, 'leftupperarm', 'leftarm'), [-0.34, -0.1, -0.2]],
    [findBone(root, 'leftforearm', 'leftlowerarm'), [-0.48, 0.05, 0.08]],
    [findBone(root, 'rightupperarm', 'rightarm'), [-0.4, 0.08, 0.16]],
    [findBone(root, 'rightforearm', 'rightlowerarm'), [-0.58, -0.04, -0.06]],
    [findBone(root, 'spine2', 'spine1'), [-0.035, 0, 0]],
  ].filter(([bone]) => bone)

  const tracks = pose.map(([bone, rotation]) => {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'XYZ'))
    return new THREE.QuaternionKeyframeTrack(
      `${bone.name}.quaternion`,
      [0, 1],
      [quaternion.x, quaternion.y, quaternion.z, quaternion.w, quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    )
  })
  if (!tracks.length) return null

  const clip = new THREE.AnimationClip('RifleHoldAdditive', 1, tracks, THREE.AdditiveAnimationBlendMode)
  const action = mixer.clipAction(clip)
  action.blendMode = THREE.AdditiveAnimationBlendMode
  action.enabled = true
  action.setEffectiveWeight(0.68)
  action.play()
  return action
}
