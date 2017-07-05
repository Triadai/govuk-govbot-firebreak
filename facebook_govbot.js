var Botkit = require('./lib/Botkit.js');
var os = require('os');
var request = require('sync-request');
const SmartAnswerConversation = require('./src/smart_answer_conversation');

var controller = Botkit.facebookbot({
    debug: true,
    access_token: process.env.page_token,
    verify_token: process.env.verify_token,
});

var bot = controller.spawn({});

controller.setupWebserver(process.env.PORT || 3000, function(err, webserver) {
  controller.createWebhookEndpoints(webserver, bot, function() {
    console.log('ONLINE!');
  });
});

var HELLO = new RegExp(/^(hey|hello|hi|help|yo)/i);

controller.hears([HELLO], 'message_received', function(bot, message) {
  bot.reply(message, "Hi! I am Govbot. I can answer certain questions about government services. What do you want to know?")
})

var emoji = require('node-emoji')

controller.on('message_received', function(bot, message) {
  console.log(message.text)
  var emojiTranslation = emoji.which(message.text)

  if (emojiTranslation) {
    var input = emojiTranslation.replace('_', ' ');
  } else {
    var input = message.text
  }

  // Use search to fetch the smart answer the user could be looking for
  var res = request('GET', 'https://www.gov.uk/api/search.json?filter_rendering_app=smartanswers&fields[]=title,link&count=1&q=' + input);
  var searchResult = JSON.parse(res.body)['results'][0];

  if (!searchResult) {
    bot.reply(message, "I can't find anything related to '" + input + "'. Could you be more specific?")
    return;
  }

  bot.startConversation(message, function(err, convo) {
    convo.ask('Are you looking for "' + searchResult.title + '"?', [
      {
        pattern: bot.utterances.yes,
        callback: function(response, convo) {
          convo.say("OK. I'm going to start asking some questions...");
          var smartAnswerSlug = searchResult.link.replace('/', '');
          SmartAnswerConversation.start(smartAnswerSlug, bot, convo);
          convo.next();
        }
      },
      {
        pattern: bot.utterances.no,
        default: true,
        callback: function(response, convo) {
          convo.say('Okay, are you looking for something else?');
          convo.next();
        }
      }
    ]);
  });
});
