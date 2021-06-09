const socket = io();

//elements
const $messageForm = document.querySelector('#message-form');
const $messageFormInput = $messageForm.querySelector('input');
const $messageFormButton = $messageForm.querySelector('button');
const $sendLocationButton = document.getElementById('send-location');
const $messages = document.querySelector('#message');

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
  document.querySelector('#sidebar').insertAdjacentHTML('beforeend', html);
  autoscroll();
});

$messageForm.addEventListener('submit', (e) => {
  e.preventDefault();

  $messageFormButton.setAttribute('disabled', 'disabled');

  const inputValue = e.target.elements.message.value;
  socket.emit('sendMessage', inputValue, (error) => {
    $messageFormButton.removeAttribute('disabled');
    $messageFormInput.value = '';
    $messageFormInput.focus();
    if (error) {
      return console.log(error);
    }
    console.log('The message was delivered');
  });
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
