export class GameHud {
  constructor() {
    this.healthFill = document.querySelector('#health-fill')
    this.healthText = document.querySelector('#health-text')
    this.danger = document.querySelector('#danger')
    this.deathScreen = document.querySelector('#death-screen')
    this.previousHealth = 100
    this.damageTimer = null
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
}
