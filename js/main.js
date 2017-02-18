import io from 'npm:socket.io-client@1.7.2';

//Conexión con el servidor mediante socket.io
var socket = io('https://cschat-server.herokuapp.com/');

var messageForm = $('#sendMessage');
var message = $('#message');
var chatroom = $('#chatroom');

var nickname = $('#nickname');
var setNick = $('#setNick');
var users = $('#users');

//$('#chatview').tabs();

//Para que el socket reconozca al usuario
var my_username = "";
var my_id = "";

var toSocket= "chatroom";
var fromSocket= "#";
var toSocketDiv="#";

//Para la creación de las conversaciones y los divs de la lista de usuarios
var divusers = $('#conversations');

var fromUser = "";

setNick.click(function(e){
  e.preventDefault();
  socket.emit('newUser', nickname.val(), function(data){
    if (data){
      $('#nickContainer').hide();
      $('#content').show();
    } else {
      $('#login-error').show();
    }
  });

  my_username = nickname.val();
  console.log('tosocket: %s user: %s',toSocket,my_username);
});

messageForm.submit(function(e) {
  e.preventDefault();
  if (message.val()!='')socket.emit('sendMessage', toSocket, my_username, my_id, message.val());
  message.val('');
});

socket.on('newMessage', function(action, data) {
  console.log(action,data);

  if (action == "online") {
    chatroom.append("<p class='col-md-12 alert-info'>" + data + "</p>");
  }else if (action == "offline") {
    chatroom.append("<p class='col-md-12 alert-danger'>" + data + "</p>");
  }else if (action == "message") {
    chatroom.append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");
  }else if (action == "privateMessageTo") {
    fromSocket += (data.fromid);
    $(fromSocket).append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");

    $.notify()
  }else if (action == "privateMessageFrom") {
    toSocketDiv += (data.to);
    $(toSocketDiv).append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");
  }

});

socket.on('usernames', function(data){
  var usernamesString = "";
  var newConversation = "";

  for(var username in data){

    usernamesString+="<div class='friend' data-target='"+data[username]+"'><p><strong>"+username+"</strong></p></div></button>"
    newConversation+="<div class='chat-messages' id='"+data[username]+"'></div>"

    $('.chat-messages').hide();
    console.log(data);
  }
  users.html(usernamesString);
  divusers.html(newConversation);

  $('.friend').click(function() {
    //toSocket = $(this).attr('href');
    //toSocket = toSocket.substring(1);

    my_id = data[my_username];
    //$(divID).toggle();
    //socket.emit('check_user', my_username, my_id);

    //Hide current visible section
    $('.chat-messages:visible').hide();

    // Show selected section
    toSocket = $(this).data('target');
    if (toSocket=="chatroom") {
      $('#chatroom').show();
    }else{
      $('#conversations > #'+toSocket).show();

    }


    console.log('id: %s toSocket: %s', my_id, toSocket);
  }).first().click();
});
