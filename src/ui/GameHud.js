export class GameHud {
  constructor() {
    this.healthFill = document.querySelector('#health-fill')
    this.healthText = document.querySelector('#health-text')
    this.danger = document.querySelector('#danger')
    this.deathScreen = document.querySelector('#death-screen')
    this.monsterHealthFill = document.querySelector('#monster-health-fill')
    this.monsterHealthText = document.querySelector('#monster-health-text')
    this.ammoCount = document.querySelector('#ammo-count')
    this.ammoPanel = document.querySelector('#ammo-panel')
    this.combatTip = document.querySelector('#combat-tip')
    this.previousHealth = 100
    this.damageTimer = null
    this.tipIndex = 0
    this.tips = ['SHOOT THE RAMPAGE', 'KEEP MOVING · RELOAD BEHIND COVER', 'THE MONSTER DESTROYS ITS PATH', 'AIM CENTER MASS · FIRE TOGETHER']
    this.tipTimer = window.setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % this.tips.length
      this.combatTip.textContent = this.tips[this.tipIndex]
    }, 5200)
  }

  setHealth(health, maxHealth) {
    const percent = Math.max(0, (health / maxHealth) * 100)
    this.healthFill.style.width = `${percent}%`
    this.healthFill.classList.toggle('critical', percent <= 30)
    this.healthText.textContent = `${Math.ceil(health)} / ${maxHealth}`
    this.deathScreen.classList.toggle('visible', health <= 0)
    if (health < this.previousHealth && health > 0) {
      document.body.classList.remove('damaged')
      requestAnimationFrame(() => document.body.classList.add('damaged'))
      clearTimeout(this.damageTimer)
      this.damageTimer = setTimeout(() => document.body.classList.remove('damaged'), 260)
    }
    this.previousHealth = health
  }

  setDanger(active) {
    this.danger.classList.toggle('visible', active)
  }

  setMonsterHealth(health, maxHealth) {
    const safeMax = Math.max(1, maxHealth)
    const percent = Math.max(0, Math.min(1, health / safeMax)) * 100
    this.monsterHealthFill.style.width = `${percent}%`
    this.monsterHealthText.textContent = `${Math.ceil(health)} / ${safeMax}`
  }

  setAmmo(ammo, reserve, reloading = false) {
    this.ammoCount.textContent = String(ammo).padStart(2, '0')
    this.ammoPanel.querySelector('span').textContent = `/ ${reserve}`
    this.ammoPanel.classList.toggle('reloading', reloading)
  }

  dispose() {
    clearInterval(this.tipTimer)
  }
}
