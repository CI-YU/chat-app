const generateMessage = (username, text, type) => {
  return {
    username,
    text,
    type: type,
    createAt: new Date().getTime(),
  };
};

const generateLocationMessage = (username, url) => {
  return {
    username,
    url,
    createAt: new Date().getTime(),
  };
};

module.exports = { generateMessage, generateLocationMessage };
