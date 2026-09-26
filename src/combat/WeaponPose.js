import * as THREE from 'three'

const poseCache = new WeakMap()
const identity = new THREE.Quaternion()

function findBone(root, ...tokens) {
  let result = null
  root.traverse((child) => {
    if (result || !child.isBone) return
    const name = child.name.toLowerCase().replace(/[^a-z]/g, '')
    if (tokens.some((token) => name.includes(token))) result = child
  })
  return result
}

function getPose(root) {
  if (poseCache.has(root)) return poseCache.get(root)
  const euler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))
  const pose = [
    [findBone(root, 'leftupperarm', 'leftarm'), euler(-0.82, -0.18, -0.34)],
    [findBone(root, 'leftforearm', 'leftlowerarm'), euler(-1.02, 0.08, 0.18)],
    [findBone(root, 'rightupperarm', 'rightarm'), euler(-0.9, 0.14, 0.28)],
    [findBone(root, 'rightforearm', 'rightlowerarm'), euler(-1.18, -0.08, -0.12)],
    [findBone(root, 'spine2', 'spine1'), euler(-0.08, 0, 0)],
  ].filter(([bone]) => bone)
  poseCache.set(root, pose)
  return pose
}

export function applyWeaponHoldPose(root, weight = 1) {
  const clampedWeight = THREE.MathUtils.clamp(weight, 0, 1)
  for (const [bone, offset] of getPose(root)) {
    bone.quaternion.multiply(identity.clone().slerp(offset, clampedWeight))
  }
}
