// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyBAdSOAxtWY5sFFzXX53UG_Mj0gfwf36kM",
  authDomain: "matchroom-2026.firebaseapp.com",
  projectId: "matchroom-2026",
  storageBucket: "matchroom-2026.appspot.com",
  messagingSenderId: "473403327201",
  appId: "1:473403327201:web:5ebc8c3a77930418e0eda0"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ===== Global Variables =====
let currentUser;
let currentMatchId;
let userTeam;

document.addEventListener('DOMContentLoaded',()=>{

  // ===== Google Sign-In =====
  const googleSignInBtn = document.querySelector('.btn-google');
  googleSignInBtn?.addEventListener('click',()=>{
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(result=>{ currentUser=result.user; document.querySelector('.profile-setup').style.display='flex'; })
      .catch(err=>console.error(err));
  });

  // ===== Create Profile =====
  const createProfileBtn = document.getElementById('createProfileBtn');
  createProfileBtn?.addEventListener('click',()=>{
    const username = document.getElementById('username').value;
    const club = document.getElementById('clubSelect').value;
    const nationality = document.getElementById('nationalitySelect').value;
    if(!username||!club||!nationality||!currentUser) return alert('Fill all fields');
    db.collection('users').doc(currentUser.uid).set({username, club, nationality, email:currentUser.email})
      .then(()=> window.location.href='home.html');
  });

  // ===== Join Match =====
  window.joinMatch=(matchId, team)=>{
    currentMatchId=matchId; userTeam=team;
    db.collection('users').doc(currentUser.uid).update({team:userTeam});
    window.location.href=`match.html?matchId=${matchId}&team=${team}`;
  };

  // ===== Match Page Logic =====
  if(window.location.pathname.includes('match.html')){
    const params = new URLSearchParams(window.location.search);
    currentMatchId=params.get('matchId'); userTeam=params.get('team');
    const teamAChat = document.getElementById('teamAChat');
    const teamBChat = document.getElementById('teamBChat');
    const messageInput = document.getElementById('messageInput');
    const sendMsgBtn = document.getElementById('sendMsgBtn');
    const stickerBtn = document.getElementById('stickerBtn');
    const stickerOverlay = document.getElementById('stickerOverlay');
    const liveHighlights = document.getElementById('liveHighlights');

    // ===== Scroll Chat =====
    document.querySelectorAll('.chatColumn').forEach(chat=>{
      const obs=new MutationObserver(()=>chat.scrollTop=chat.scrollHeight);
      obs.observe(chat,{childList:true});
    });

    // ===== Send Message =====
    sendMsgBtn?.addEventListener('click',()=>{
      const text=messageInput.value.trim();
      if(!text) return;
      db.collection('rooms').doc(currentMatchId).collection(`${userTeam}_messages`).add({
        userId:currentUser.uid,
        username:currentUser.displayName,
        text,
        timestamp:firebase.firestore.Timestamp.now(),
        reactions:{}
      });
      messageInput.value='';
    });

    // ===== Render Messages =====
    function renderMessages(team){
      db.collection('rooms').doc(currentMatchId).collection(`${team}_messages`)
        .orderBy('timestamp')
        .onSnapshot(snapshot=>{
          const chatDiv = team==='teamA'?teamAChat:teamBChat;
          chatDiv.innerHTML='';
          snapshot.docs.forEach(doc=>{
            const msg = doc.data();
            const div = document.createElement('div');
            div.className='message';
            div.textContent=`${msg.username}: ${msg.text}`;
            div.dataset.msgId=doc.id;
            div.dataset.userId=msg.userId;

            // Hover
            div.addEventListener('mouseenter',()=>div.style.boxShadow='0 0 10px gold');
            div.addEventListener('mouseleave',()=>div.style.boxShadow='none');

            // Private reply
            div.addEventListener('click',()=>{
              const reply = prompt(`Reply privately to ${msg.username}:`);
              if(reply){
                db.collection('privateReplies').add({
                  fromUserId:currentUser.uid,
                  toUserId:msg.userId,
                  message:reply,
                  timestamp:firebase.firestore.Timestamp.now()
                }).then(()=>alert('Private reply sent!'));
              }
            });

            // Reactions
            const reactionsDiv=document.createElement('div'); reactionsDiv.className='reactions';
            ['❤️','⚽','🔥'].forEach(emoji=>{
              const btn=document.createElement('span'); btn.textContent=emoji;
              btn.addEventListener('click',e=>{
                e.stopPropagation();
                const ref=db.collection('rooms').doc(currentMatchId).collection(`${team}_messages`).doc(doc.id);
                const updated={...msg.reactions}; updated[emoji]=(updated[emoji]||0)+1;
                ref.update({reactions:updated});
              });
              reactionsDiv.appendChild(btn);
            });
            const reactionsCountDiv=document.createElement('div'); reactionsCountDiv.className='reactionsCount';
            if(msg.reactions){ for(let key in msg.reactions) reactionsCountDiv.textContent+=`${key} ${msg.reactions[key]} `; }

            div.appendChild(reactionsDiv); div.appendChild(reactionsCountDiv);
            chatDiv.appendChild(div);
          });
        });
    }
    renderMessages('teamA'); renderMessages('teamB');

    // ===== Stickers =====
    async function loadPurchasedStickers(){
      if(!currentUser) return;
      const userDoc=await db.collection('users').doc(currentUser.uid).get();
      const purchased=userDoc.data().stickers||[];
      stickerBtn?.addEventListener('click',()=>{
        if(purchased.length===0){ alert('Buy stickers first!'); return; }
        const stickerFiles=purchased.map(id=>`/assets/stickers/${id}.json`);
        const file=stickerFiles[Math.floor(Math.random()*stickerFiles.length)];
        const div=document.createElement('div'); div.className='stickerAnimation';
        div.innerHTML=`<lottie-player src="${file}" background="transparent" speed="1" loop autoplay></lottie-player>`;
        div.style.position='absolute'; div.style.top=`${Math.random()*60}%`; div.style.left=`${Math.random()*70}%`;
        div.style.border=`3px solid ${userTeam==='teamA'?'red':'blue'}`;
        stickerOverlay.appendChild(div);
        setTimeout(()=>div.remove(),5000);
        confetti({particleCount:30,spread:70,origin:{y:0.6}});
      });
    }
    loadPurchasedStickers();

    // ===== Countdown =====
    const timerEl = document.getElementById('timer');
    if(timerEl){
      const startTime = new Date(timerEl.dataset.startTime);
      const updateTimer=()=>{
        const now=new Date(); let diff=Math.max(0,startTime-now);
        const mins=Math.floor(diff/60000); const secs=Math.floor((diff%60000)/1000);
        timerEl.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if(diff>0) requestAnimationFrame(updateTimer);
      }
      updateTimer();
    }

    // ===== Live Highlights =====
    const liveH=liveHighlights;
    if(liveH){
      db.collection('rooms').doc(currentMatchId).collection('highlights').orderBy('timestamp')
        .onSnapshot(snapshot=>{
          liveH.innerHTML=''; snapshot.docs.forEach(doc=>{
            const highlight=doc.data();
            const div=document.createElement('div'); div.textContent=`${highlight.time} - ${highlight.event}`;
            liveH.appendChild(div);
          });
        });
    }

  }

  // ===== Sticker Shop =====
  const stickerShop = document.getElementById('stickerShop');
  if(stickerShop){
    const stickers=[
      {id:'sticker1',name:'Goal Celebration',price:1.99},
      {id:'sticker2',name:'Crazy Fan',price:2.49},
      {id:'sticker3',name:'Team Cheer',price:2.99}
    ];
    stickers.forEach(sticker=>{
      const div=document.createElement('div'); div.className='stickerCard';
      div.innerHTML=`<p>${sticker.name}</p><p>Price: $${sticker.price}</p>
