const socket = io();

//elements
const $messageForm = document.querySelector('#message-form');
const $messageFormInput = $messageForm.querySelector('input');
const $messageFormButton = $messageForm.querySelector('button');
const $sendLocationButton = document.getElementById('send-location');
const $messages = document.querySelector('#message');
const $gptButtons = document.querySelectorAll('.gpt-button-bar .gpt-button')
const $gptSettingForm = document.querySelector('#gpt-setting-form');

//templates
const messageTemplate = document.querySelector('#message-template').innerHTML;
const locationTemplate = document.querySelector('#location-template').innerHTML;
const sidebarTemplate = document.querySelector('#sidebar-template').innerHTML;

//options
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const autoscroll = () => {
  //New message element
  const $newMessage = $messages.lastElementChild;

  //Height of the new message
  const newMessageStyles = getComputedStyle($newMessage);
  const newMessageMargin = parseInt(newMessageStyles.marginBottom);
  const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

  //Visible heigth
  const visibleHeight = $messages.offsetHeight;

  //Height of messages container
  const containerHeight = $messages.scrollHeight;

  //How far have I scrolled?
  const scrollOffset = $messages.scrollTop + visibleHeight;

  if (containerHeight - newMessageHeight <= scrollOffset) {
    $messages.scrollTop = $messages.scrollHeight;
  }
};

socket.on('message', (message) => {
  const html = Mustache.render(messageTemplate, {
    username: message.username,
    message: message.text,
    createAt: moment(message.createAt).format('h:mm a'),
  });
  $messages.insertAdjacentHTML('beforeend', html);
  autoscroll();
});
socket.on('reply', ({ user, msg, messages }) => {
  if (user === username) {
    messages.push({ "role": "assistant", "content": msg })
    sessionStorage.setItem(user, JSON.stringify(messages))
  }
});
socket.on('locationMessage', (message) => {
  const html = Mustache.render(locationTemplate, {
    username: message.username,
    url: message.url,
    createAt: moment(message.createAt).format('h:mm a'),
  });
  $messages.insertAdjacentHTML('beforeend', html);
  autoscroll();
});

socket.on('roomData', ({ room, users }) => {
  console.log(room);
  const html = Mustache.render(sidebarTemplate, {
    room,
    users,
  });
  document.querySelector('#sidebar').innerHTML = html;
  autoscroll();
});
$gptSettingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const roleValue = e.target.role.value
  const replyType = e.target.replyType.value
  let replyTypeString = ``
  if (replyType === "1") {
    replyTypeString = `英文，並透過對話`
  } else {
    replyTypeString = `英文，並使用書信體`
  }

  const msg = `你是${roleValue}，接下來請用${replyTypeString}的模式來回答，please use english`
  const historyMsgArr = JSON.parse(sessionStorage.getItem(username)) || []
  const messages = [...historyMsgArr]
  if (messages.length !== 0) {
    messages.shift()
    messages.unshift({ "role": "system", "content": msg })
  } else {
    messages.push({ "role": "system", "content": msg })
  }
  sessionStorage.setItem(username, JSON.stringify(messages))
  alert('基礎設定完成')
})

$messageForm.addEventListener('submit', (e) => {
  e.preventDefault();

  $messageFormButton.setAttribute('disabled', 'disabled');

  const inputValue = e.target.elements.message.value;
  const callType = document.querySelector('.gpt-button-bar .gpt-button.active')?.dataset.type || null

  if (inputValue.startsWith('$ai ')) {
    const historyMsgArr = JSON.parse(sessionStorage.getItem(username)) || []
    const messages = [...historyMsgArr]
    messages.push({ "role": "user", "content": inputValue.slice(3) })
    if (messages.length > 20) {
      messages.shift()
    }

    socket.emit('sendAiMessage', { inputValue, messages }, (error) => {
      $messageFormButton.removeAttribute('disabled');
      $messageFormInput.value = '';
      $messageFormInput.focus();
      if (error) {
        return console.log(error);
      }
      console.log('The AI message was delivered');
    });
  } else {
    socket.emit('sendMessage', { inputValue, callType }, (error) => {
      $messageFormButton.removeAttribute('disabled');
      $messageFormInput.value = '';
      $messageFormInput.focus();
      if (error) {
        return console.log(error);
      }
      console.log('The message was delivered');
    });
  }

});

document.querySelector('#send-location').addEventListener('click', () => {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported by your brower');
  }
  $sendLocationButton.setAttribute('disabled', 'disabled');
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit(
      'sendLocation',
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      (msg) => {
        $sendLocationButton.removeAttribute('disabled');
        console.log(msg);
      }
    );
  });
});

socket.emit('join', { username, room }, (error) => {
  if (error) {
    alert(error);
    location.href = '/';
  }
});

$gptButtons.forEach((el) => {
  el.addEventListener('click', selectGptType)
})

function selectGptType(e) {
  if (e.target.classList.contains('active')) {
    e.target.classList.remove('active')
  } else {
    $gptButtons.forEach((el) => {
      el.classList.remove('active')
    })
    e.target.classList.add('active')
  }
}