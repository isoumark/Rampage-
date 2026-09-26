const ROOMS = ['LOBBY', 'SURVIVORS']

export class ChatRooms {
  constructor({ network, canvas }) {
    this.network = network
    this.canvas = canvas
    this.activeRoom = ROOMS[0]
    this.messages = new Map(ROOMS.map((room) => [room, []]))
    this.panel = document.querySelector('#chat-panel')
    this.messageList = document.querySelector('#chat-messages')
    this.form = document.querySelector('#chat-form')
    this.input = document.querySelector('#chat-input')
    this.toggleButton = document.querySelector('#chat-toggle')

    document.querySelectorAll('[data-room]').forEach((button) => {
      button.addEventListener('click', () => this.selectRoom(button.dataset.room))
    })
    this.form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (this.send(this.input.value)) this.input.value = ''
      this.closeAndReturnControl()
    })
    this.network.onChat((message) => this.receive(message))
    this.network.onStatus((status) => {
      this.receive({
        room: 'LOBBY',
        author: 'SYSTEM',
        text: status === 'ONLINE'
          ? 'Online comms connected.'
          : status === 'CONNECTING'
            ? 'Connecting to online comms…'
            : 'Reconnecting to online comms…',
      })
    })
    this.toggleButton.addEventListener('click', () => this.toggle())
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Slash' && document.activeElement !== this.input) {
        event.preventDefault()
        this.panel.classList.remove('collapsed')
        this.toggleButton.textContent = '−'
        this.input.focus()
        return
      }
      if (event.code === 'Enter' && document.activeElement !== this.input) {
        this.panel.classList.remove('collapsed')
        this.input.focus()
      }
      if (event.code === 'Escape' && document.activeElement === this.input) {
        this.closeAndReturnControl()
      }
    })
  }

  toggle() {
    const collapsed = this.panel.classList.toggle('collapsed')
    this.toggleButton.textContent = collapsed ? '+' : '−'
    if (!collapsed) this.input.focus()
  }

  selectRoom(room) {
    if (!ROOMS.includes(room)) return
    this.activeRoom = room
    document.querySelectorAll('[data-room]').forEach((button) => {
      button.classList.toggle('active', button.dataset.room === room)
    })
    this.render()
  }

  send(rawText) {
    const text = rawText.trim().slice(0, 180)
    if (!text) return false
    if (this.network.sendChat(this.activeRoom, text)) return true
    this.receive({ room: this.activeRoom, author: 'SYSTEM', text: 'Message not sent: reconnecting.' })
    return false
  }

  closeAndReturnControl() {
    this.input.blur()
    this.panel.classList.add('collapsed')
    this.toggleButton.textContent = '+'
    this.canvas?.focus({ preventScroll: true })
  }

  receive(message) {
    if (!ROOMS.includes(message?.room) || typeof message.text !== 'string') return
    const list = this.messages.get(message.room)
    list.push({ author: String(message.author).slice(0, 24), text: message.text.slice(0, 180) })
    if (list.length > 40) list.shift()
    if (message.room === this.activeRoom) this.render()
  }

  render() {
    this.messageList.replaceChildren()
    for (const message of this.messages.get(this.activeRoom)) {
      const row = document.createElement('div')
      const author = document.createElement('b')
      author.textContent = message.author
      row.append(author, document.createTextNode(`  ${message.text}`))
      this.messageList.append(row)
    }
    this.messageList.scrollTop = this.messageList.scrollHeight
  }
}
