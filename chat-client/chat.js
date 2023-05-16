import * as Vue from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from 'https://graffiti.garden/graffiti-js/plugins/vue/plugin.js'
import Resolver from './resolver.js'

const app = {
  // Import MaVue
  mixins: [mixin],
  // Import resolver
  created() {
    this.resolver = new Resolver(this.$gf)

  },

  setup() {
    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref('default-demo')

    // And a flag for whether or not we're private-messaging
    const privateMessaging = Vue.ref(false)

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject('graffiti')
    const context = Vue.computed(()=> privateMessaging.value? [$gf.me] : [channel.value])

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context)
    return { channel, privateMessaging, messagesRaw }
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: '',
      editID: '',
      editText: '',
      recipient: '',

      // Problem 1 solution
      preferredUsername: '',
      usernameResult: '',

      // Problem 2 solution
      recipientUsername: '',
      recipientUsernameSearch: '',

      // Problem 3 solution
      myUsername: '',
      actordict: {},

      imageDownloads: {},

      buttonDisabled: false,
    }
  },

  //////////////////////////////
  // Problem 3 solution
  watch: {
    '$gf.me': async function(me) {
      this.myUsername = await this.resolver.actorToUsername(me)
    },

    async messages(messages) {
      for (const m of messages) {
        if (!(m.actor in this.actordict)) {
          this.actordict[m.actor] = await this.resolver.actorToUsername(m.actor)
        }
        if (m.bto && m.bto.length && !(m.bto[0] in this.actordict)) {
          this.actordict[m.bto[0]] = await this.resolver.actorToUsername(m.bto[0])
        }
      }
    },

    async messagesWithAttachments(messages) {
      for (const m of messages) {
        if (!(m.attachment.magnet in this.imageDownloads)) {
          this.imageDownloads[m.attachment.magnet] = "downloading"
          let blob
          try {
            blob = await this.$gf.media.fetch(m.attachment.magnet)
          } catch(e) {
            this.imageDownloads[m.attachment.magnet] = "error"
            continue
          }
          this.imageDownloads[m.attachment.magnet] = URL.createObjectURL(blob)
        }
      }
    },
  },


  computed: {
    messages() {
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m=>
          // Does the message have a type property?
          m.type         &&
          // Is the value of that property 'Note'?
          m.type=='Note' &&
          // Does the message have a content property?
          (m.content || m.content == '') &&
          // Is that property a string?
          typeof m.content=='string')

      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m=>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }

      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2)=> new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0,50)
    },

    messagesWithAttachments() {
      return this.messages.filter(m=>
        m.attachment &&
        m.attachment.type == 'Image' &&
        typeof m.attachment.magnet == 'string')
    }
  },

  methods: {
    async sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
      }

      if (this.file) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
        this.file = null
      }

      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private
      if (this.privateMessaging) {
        message.bto = [this.recipient]
        message.context = [this.$gf.me, this.recipient]
      } else {
        message.context = [this.channel]
      }

      // Send!
      this.$gf.post(message)
      this.messageText = ''

    },

    removeMessage(message) {
      this.$gf.remove(message)
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id
      // And copy over it's existing text
      this.editText = message.content
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText
      // And clear the edit mark
      this.editID = ''
    },

    /////////////////////////////
    // Problem 1 solution
    async setUsername() {
      try {
        this.usernameResult = await this.resolver.requestUsername(this.preferredUsername)
        this.myUsername = this.preferredUsername
      } catch (e) {
        this.usernameResult = e.toString()
      }
    },
    /////////////////////////////

    /////////////////////////////
    // Problem 2 solution
    async chatWithUser() {
      this.recipient = await this.resolver.usernameToActor(this.recipientUsernameSearch)
      this.recipientUsername = this.recipientUsernameSearch
    },
    /////////////////////////////

    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file
    },

    resizeTextarea(event) {
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    },

    disableButton() {
      this.buttonDisabled = true;
    },

    copyText() {
      const copyBtn = document.getElementById('copyBtn');
      const myTextarea = document.getElementById('message');
      
      myTextarea.select();
      document.execCommand('copy');
      
      // Change the text of the button to "Text copied"
      copyBtn.value = "Text Copied";
      
      // Change the text back to "Copy to clipboard" after 2 seconds
      setTimeout(() => {
        copyBtn.value = "Copy to Clipboard";
      }, 1000);
    },

    async sendToSelf() {
      const message = {
        type: 'Note',
        content: this.messageText,
      }

      if (this.file) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
        this.file = null
      }
      
      message.bto = [this.$gf.me]
      message.context = [this.$gf.me, this.$gf.me]


      // Send!
      this.$gf.post(message)
      
    },

  chatSelf() {
    this.recipient = this.$gf.me
    this.recipientUsername = this.myUsername
    const selfChat = document.getElementById('self-chat')
    selfChat.style.backgroundColor = rgb(117, 180, 201);
  },

  settings() {
    // Get the modal element
    var modal = document.getElementById("settings-modal");

    // Get the button that opens the modal
    var btn = document.getElementById("settings");

    // Get the close button
    var span = document.getElementById("close-button");

    // When the user clicks on the button, open the modal
    btn.onclick = function() {
      modal.style.display = "block";
    }

    // When the user clicks on the close button, close the modal
    span.onclick = function() {
      modal.style.display = "none";
    }

    // When the user clicks outside of the modal, close it
    window.onclick = function(event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    }
  },

  convertToLocal(dateString) {
    const date = new Date(dateString)
    const localDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000))
    this.localDate = localDate.toLocaleString()
  }


  }
}

const Name = {
  props: ['actor', 'editable'],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        // Filter the raw objects for profile data
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-profile 
        .filter(m=>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Profile'?
          m.type=='Profile' &&
          // Does the message have a name property?
          m.name &&
          // Is that property a string?
          typeof m.name=='string')
        // Choose the most recent one or null if none exists
        .reduce((prev, curr)=> !prev || curr.published > prev.published? curr : prev, null)
    }
  },

  data() {
    return {
      editing: false,
      editText: ''
    }
  },

  methods: {
    editName() {
      this.editing = true
      // If we already have a profile,
      // initialize the edit text to our existing name
      this.editText = this.profile? this.profile.name : this.editText
    },

    saveName() {
      if (this.profile) {
        // If we already have a profile, just change the name
        // (this will sync automatically)
        this.profile.name = this.editText
      } else {
        // Otherwise create a profile
        this.$gf.post({
          type: 'Profile',
          name: this.editText
        })
      }

      // Exit the editing state
      this.editing = false
    }
  },

  template: '#name'
}

const Like = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: likesRaw } = $gf.useObjects([messageid])
    return { likesRaw }
  },

  computed: {
    likes() {
      return this.likesRaw.filter(l=>
        l.type == 'Like' &&
        l.object == this.messageid)
    },

    numLikes() {
      // Unique number of actors
      return [...new Set(this.likes.map(l=>l.actor))].length
    },

    myLikes() {
      return this.likes.filter(l=> l.actor == this.$gf.me)
    }
  },

  methods: {
    toggleLike() {
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes)
      } else {
        this.$gf.post({
          type: 'Like',
          object: this.messageid,
          context: [this.messageid]
        })
      }
    }
  },

  template: '#like'
}

const Read = {
  props: ["messageid","actordict"],

  created() {
    this.refreshKey = 0;
    this.sendRead();
  },

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const state = Vue.toRefs(props);
    const messageid = Vue.toRef(props, 'messageid')
    const actordict = Vue.toRef(props, 'actordict')
    const { objects: readsRaw } = $gf.useObjects([messageid])
    return { readsRaw }
  },

  watch: {
    actordict: function(newVal){
      this.refreshKey +=1;
    }

  },

  computed: {
    reads() {
      return this.readsRaw.filter(l=>
        l.type == 'Read' &&
        l.object == this.messageid)
    },

    readsActor() {
      return [...new Set(this.reads.map(l=>l.actor))]
    },

    readsUsers() {
      return this.readsActor.map(a=> this.actordict && this.actordict[a] ? this.actordict[a] : a)
    },

    myRead() {
      console.log("hello")
      return this.reads.filter(l=> l.actor == this.$gf.me)
    }
  },

  methods: {
    sendRead() {
      if (this.myRead.length == 0) {
        this.$gf.post({
          type: 'Read',
          object: this.messageid,
          context: [this.messageid]
        })
        this.readsRaw = this.$gf.useObjects([this.messageid]);
      }
    }
  },

  template: '#read'
}

const Reply = {

  props: ["messageid","actordict"],

  components: {
    'read': Read,
    'name': Name,
    'like': Like,
  },

  created() {
    this.refreshKey = 0;

  },

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const actordict = Vue.toRef(props, 'actordict')
    const { objects: repliesRaw } = $gf.useObjects([messageid])
    return { repliesRaw }
  },

  computed: {
    replies() {
      return this.repliesRaw.filter(l=>
        l.type == 'Note' &&
        l.inReplyTo == this.messageid)
    },

    myReply() {
      return this.replies.filter(l=> l.actor == this.$gf.me)
    }
  },

  watch: {
    actordict: function(newVal){
      this.refreshKey +=1;
    }
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: '',
      editID: '',
      editText: '',
    }
  },

  methods: {
    async sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
        inReplyTo: this.messageid,
        context: [this.messageid]
      }

      if (this.file) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
        this.file = null
      }

      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private

      // Send!
      this.$gf.post(message);
      this.messageText = ''

    },

    removeMessage(message) {
      this.$gf.remove(message)
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id
      // And copy over it's existing text
      this.editText = message.content
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText
      // And clear the edit mark
      this.editID = ''
    },
  },

  template: '#reply'
}

const Profile = {
  props: {
    actor: {
      type: String
    },
    editable: {
      type: Boolean,
      default: false
    },
    anonymous: {
      type: String,
      default: 'magnet:?xt=urn:btih:58c03e56171ecbe97f865ae9327c79ab3c1d5f16&dn=Anonymous.svg&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
    }
  },

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        .filter(m=>
          m.type=='Profile' &&
          m.icon &&
          m.icon.type == 'Image' &&
          typeof m.icon.magnet == 'string')
        .reduce((prev, curr)=> !prev || curr.published > prev.published? curr : prev, null)
    }
  },

  data() {
    return {
      file: null
    }
  },

  methods: {
    async savePicture() {
      if (!this.file) return

      this.$gf.post({
        type: 'Profile',
        icon: {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
      })
    },

    onPicture(event) {
      const file = event.target.files[0]
      this.file = file
    }
  },

  template: '#profile'
}

const MagnetImg = {
  props: {
    src: String,
    loading: {
      type: String,
      default: 'icons/default.webp'
    },
    error: {
      type: String,
      default: '' // empty string will trigger broken link
    }
  },

  data() {
    return {
      fetchedSrc: ''
    }
  },

  watch: {
    src: {
      async handler(src) {
        this.fetchedSrc = this.loading
        try {
          this.fetchedSrc = await this.$gf.media.fetchURL(src)
        } catch {
          this.fetchedSrc = this.error
        }
      },
      immediate: true
    }
  },

  template: '<img :src="fetchedSrc" style="max-width: 8rem" />'
}


Vue.createApp(app)
   .component('name', Name)
   .component('like', Like)
   .component('magnet-img', MagnetImg)
   .component('profile', Profile)
   .component('reply', Reply)
   .component('read', Read)
   .use(GraffitiPlugin(Vue))
   .mount('#app')
