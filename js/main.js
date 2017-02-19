//importamos socket.io-client desde jspm_packages
import io from 'npm:socket.io-client@1.7.2';

//Conexión con el servidor mediante socket.io
var socket = io('https://cschat-server.herokuapp.com/');
//var socket = io('http://localhost:3000');

//variables usadas con el fin de manejar lo que sucede en el html
var messageForm = $('#sendMessage');  //form
var message = $('#message');  //input
var chatroom = $('#chatroom');  //div chatroom

var nickname = $('#nickname'); //input nickname
var setNick = $('#setNick');  //button

var users = $('#users');  //div de usuarios


//Para que el socket reconozca al usuario
var my_username = "";
var my_id = "";

//para manejar el envío y recepción de mensajes
var toSocket= "chatroom"; //se inicializa con "chatroom" para que pueda mandar un msj sin necesidad de esperar que se seleccione el usuario
var fromSocket= "";  //el id del div de usuario del que viene el mensaje privado
var toSocketDiv=""; //el id del div de usuario al que se manda el mensaje privado

//Para la creación de las conversaciones y los divs de la lista de usuarios
var divusers = $('#conversations');

//éste evento controla la creación de usuarios
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

  //aquí se almacena el nombre del usuario
  my_username = nickname.val();
  console.log('tosocket: %s user: %s',toSocket,my_username);
});

//controla el submit del formulario donde se envían los mensajes
messageForm.submit(function(e) {
  e.preventDefault();

  //se le manda al socket 5 parámetros, el evento sendMessage, los sockets from y to y el contenido del msj
  if (message.val()!='')socket.emit('sendMessage', toSocket, my_username, my_id, message.val());
  message.val('');
});

//Evento newMessage, controla cómo se controlará cada tipo de mensaje
socket.on('newMessage', function(action, data) {
  console.log(action,data);

  if (action == "online") {
    chatroom.append("<p class='col-md-12 alert-info'>" + data + "</p>");
  }else if (action == "offline") {
    chatroom.append("<p class='col-md-12 alert-danger'>" + data + "</p>");
  }else if (action == "message") {
    chatroom.append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");
  }else if (action == "privateMessageTo") {
    //Mensaje privado - recibe
    fromSocket = "#" + (data.fromid);
    $(fromSocket).append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");

    //aquí se manda la notificación al usuario que recibe el msj
    $.notify("Nuevo mensaje de: "+data.fromuser,"info");
  }else if (action == "privateMessageFrom") {
    //Mensaje privado - manda
    toSocketDiv = "#" + (data.to);
    $(toSocketDiv).append("<p class='col-md-12 alert-warning'><strong>" + data.fromuser + ":</strong><br> " + data.msg + "</p>");
  }

});

//Evento usernames, se listan los usuarios en el div de usuarios #users
socket.on('usernames', function(data){
  var usernamesString = "";
  var newConversation = "";

  for(var username in data){

    //se crea un div que contiene al usuario
    usernamesString+="<div class='friend' data-target='"+data[username]+"'><p><strong>"+username+"</strong></p></div>"
    //se crea el div de cada conversación
    newConversation+="<div class='chat-messages' id='"+data[username]+"'></div>"

    $('.chat-messages').hide();
    console.log(data);
  }
  users.html(usernamesString); //se pintan todos los usuarios
  divusers.html(newConversation); //se pintan todas las conversaciones

  $('.friend').click(function() {

    my_id = data[my_username];

    $('.chat-messages:visible').hide();

    // Mostrar conversación seleccionada
    toSocket = $(this).data('target');
    if (toSocket=="chatroom") {
      $('#chatroom').show();
    }else{
      $('#conversations > #'+toSocket).show();

    }

    console.log('id: %s toSocket: %s', my_id, toSocket);
  }).first().click();
});
