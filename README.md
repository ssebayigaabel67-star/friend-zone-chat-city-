<!DOCTYPE html>  <html lang="en">  
<head>  
<meta charset="UTF-8">  
<meta name="viewport" content="width=device-width, initial-scale=1.0">  
<title>Friend Zone Chat</title>  
<style>  
*{  
margin:0;  
padding:0;  
box-sizing:border-box;  
font-family:Arial,sans-serif;  
}  
body{  
background:linear-gradient(141deg,#ff00cc,#333399,#a3924e,#ffffff);  
height:100vh;  
}  
.header{  
height:70px;  
background:#2196F3;  
color:white;  
display:flex;  
justify-content:space-between;  
align-items:center;  
padding:20px;  
}  
#logoutBtn{  
background:red;  
color:white;  
border:none;  
padding:10px 15px;  
border-radius:5px;  
cursor:pointer;  
}  
.container{  
display:flex;  
height:calc(100vh - 70px);  
}  
.sidebar{  
width:30%;  
background:white;  
border-right:1px solid #ccc;  
overflow-y:auto;  
}  
.profile{  
text-align:center;  
padding:20px;  
border-bottom:1px solid #ddd;  
}  
.profile img{  
width:80px;  
height:80px;  
border-radius:50%;  
}  
.profile h3{  
margin-top:10px;  
}  
.profile button{  
padding:8px;  
margin-top:5px;  
}  
.friend{  
display:flex;  
align-items:center;  
padding:10px;  
border-bottom:1px solid #eee;  
cursor:pointer;  
}  
.friend:hover{  
background:#eee;  
}  
.friend img{  
width:45px;  
height:45px;  
border-radius:50%;  
margin-right:10px;  
}  
.status{  
width:10px;  
height:10px;  
background:green;  
border-radius:50%;  
margin-left:auto;  
}  
.chat-area{  
width:70%;  
display:flex;  
flex-direction:column;  
}  
#messages{  
flex:1;  
padding:15px;  
overflow-y:auto;  
background:#f5f5f5;  
}  
.message{  
background:white;  
padding:10px;  
margin-bottom:10px;  
border-radius:8px;  
}  
.message small{  
display:block;  
color:gray;  
font-size:12px;  
margin-top:5px;  
text-align:right;  
}  
.bottom{  
display:flex;  
padding:10px;  
background:white;  
}  
#messageInput{  
flex:1;  
padding:10px;  
font-size:10px;
  height: 50px;
}  
#sendBtn{  
margin-left:10px;  
padding:10px 20px;  
background:#2196F3;  
color:white;  
border:none;  
border-radius:5px;  
}  
#createGroupBtn{  
padding:10px;  
margin:10px;  
background:#4CAF50;  
color:white;  
border:none;  
border-radius:5px;  
}  
#groupName{  
margin:10px;  
padding:10px;  
width:90%;  
}  
  #voiceCallBtn,
#videoCallBtn {
  background: #25D366;
  color: white;
  border: none;
  padding: 8px 12px;
  margin-left: 8px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  }
</style>  
</head>  
<body>  
  <div id="typingStatus" style="font-size:14px;color:#25D366;padding:5px 10px;"></div>
<div class="header">  
<h3>FRIEND ZONE CHAT</h3> 
  
<button id="logoutBtn">  
Logout  
</button>  
</div>  
<div class="container">  
<div class="sidebar">  
<div class="profile">  
<img id="profilePic"  
src="https://via.placeholder.com/80">  
<h3 id="username">  
Loading...  
</h3>  
  <button id="voiceCallBtn">📞</button>
<button id="videoCallBtn">🎥</button>
  <button id="hangUpBtn">
  🔴 End Call
</button>

<p id="callStatus"></p>
  <audio id="localAudio" autoplay muted></audio>
<audio id="remoteAudio" autoplay></audio>
<input type="file" id="imageInput" accept="image/*">  
<button id="uploadBtn">  
ADD +  
</button>  
</div>  
<h3 style="padding:10px;">  
Friends  
</h3>  
<div id="friendsList"></div>  
<hr>  
<h3 style="padding:10px;">  
Groups  
</h3>  
<input id="groupName"  
placeholder="Group name">  
<button id="createGroupBtn">  
Create Group  
</button>  
<button id="addMemberBtn" style="display:none;">  
Add Member  
</button>  
<select id="friendSelect" style="display:none;">  
</select>  
<button id="confirmAddMemberBtn" style="display:none;">  
Add  
</button>  
<h4>Select Members</h4>  
<div id="membersList"></div>  
<div id="groupsList"></div>  
</div>  
<div class="chat-area">  
<div id="messages">  
</div>  
<div class="bottom">  
<input  
id="messageInput"  
placeholder="Type your message...">  
<input  
type="file"  
id="chatImage"  
accept="image/*"  
style="display:none;">  
<button id="imageBtn">  
📷  
</button>  
<button id="recordBtn">🎤</button>
<audio id="voicePlayer" controls style="display:none;"></audio>
<button id="sendBtn">Send</button>
</div>  
</div>  
</div>  
  <audio id="notificationSound" preload="auto">
  <source src="notification.mp3" type="audio/mpeg">
</audio>
  <div id="incomingCallBox" style="
display:none;
position:fixed;
top:50%;
left:50%;
transform:translate(-50%,-50%);
background:#fff;
padding:20px;
border-radius:12px;
box-shadow:0 0 10px rgba(0,0,0,.3);
text-align:center;
z-index:9999;
">

<h3>📞 Incoming Call</h3>

<p id="callerName">Someone is calling...</p>

<button id="acceptCallBtn">✅ Accept</button>

<button id="declineCallBtn">❌ Decline</button>

  </div>
  <audio id="remoteAudio" autoplay></audio>
<script type="module" src="Home.js"></script>
<script type="module" src="Calls.js"></script> 
<!-- ======================
CALL SCREEN
====================== -->

<div id="callScreen" style="display:none;">

    <img id="callProfilePic"
         src="images/default-profile.png"
         width="120"
         height="120">

    <h2 id="callUserName">Friend</h2>

    <p id="callStatus">Calling...</p>

    <h1 id="callTimer">00:00</h1>

    <div>

        <button id="muteBtn">🎤 Mute</button>

        <button id="speakerBtn">🔊 Speaker</button>

    </div>

    <br>

    <button id="hangUpBtn">🔴 End Call</button>

</div>

<audio id="remoteAudio" autoplay></audio>
</body>  
</html>
