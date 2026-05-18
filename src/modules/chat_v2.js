import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';

/**
 * CHAT MODULE — STABILIZED & ROBUST
 */

export async function initChat() {
  console.log("[Chat] initChat called. Store Org ID:", store.currentOrganizationId);

  if (!store.currentOrganizationId) {
    console.warn("[Chat] No organization ID found in store. Waiting for profile...");
    if (store.currentUser && store.currentUser.organization_id) {
       store.currentOrganizationId = store.currentUser.organization_id;
    } else {
       return; 
    }
  }

  try {
    await loadConversations();
    await loadGroups();
  } catch (err) {
    console.error("[Chat] Init failed:", err);
  }
}

export async function loadConversations() {
  console.log("[Chat] loadConversations started. Org:", store.currentOrganizationId);
  if (!store.currentOrganizationId) return;
  
  try {
    let query = supabaseClient.from("profiles").select("*").neq("id", store.currentUserId);
    
    if (!store.isSuperAdmin()) {
      if (!store.currentOrganizationId) return;
      query = query.eq("organization_id", store.currentOrganizationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    store.allOrgUsers = data || [];
    renderConversationList();
  } catch (err) {
    console.error("[Chat] Load contacts failed:", err);
  }
}

export async function loadGroups() {
  if (!store.currentOrganizationId) return;

  try {
    let query = supabaseClient.from("chat_groups").select("*");
    
    if (!store.isSuperAdmin()) {
      if (!store.currentOrganizationId) return;
      query = query.eq("organization_id", store.currentOrganizationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    store.chatGroups = data || [];
    renderGroups();
  } catch (err) {
    console.error("[Chat] Load groups failed:", err);
  }
}

export async function sendMessage() {
  const input = document.getElementById("chatMessageInput");
  const content = input?.value?.trim();
  if (!content) return;

  if (!store.currentOrganizationId) return alert("System error: Organization not found.");

  const payload = {
    sender_id: store.currentUserId,
    content: content,
    organization_id: store.currentOrganizationId
  };

  if (store.selectedGroupId) {
    payload.group_id = store.selectedGroupId;
  } else if (store.selectedConversationUserId) {
    payload.receiver_id = store.selectedConversationUserId;
  } else {
    return alert("Select a recipient first");
  }

  try {
    const { error } = await supabaseClient.from("messages").insert([payload]);
    if (error) throw error;
    input.value = "";
    await loadMessages();
  } catch (err) {
    console.error("[Chat] Send failed:", err);
    alert("Failed to send message.");
  }
}

export async function loadMessages() {
  if (!store.selectedConversationUserId && !store.selectedGroupId) return;

  try {
    let query = supabaseClient.from("messages").select("*");
    if (store.selectedGroupId) {
      query = query.eq("group_id", store.selectedGroupId);
    } else {
      query = query.or(`and(sender_id.eq.${store.currentUserId},receiver_id.eq.${store.selectedConversationUserId}),and(sender_id.eq.${store.selectedConversationUserId},receiver_id.eq.${store.currentUserId})`);
    }

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;
    store.chatMessages = data || [];
    renderMessages();
  } catch (err) {
    console.error("[Chat] Load messages failed:", err);
  }
}

function renderConversationList() {
  const list = document.getElementById("dmConversationList");
  if (!list) return;
  
  if (store.allOrgUsers.length === 0) {
    list.innerHTML = '<div style="padding:20px; font-size:12px; color:#94a3b8;">No other users found.</div>';
    return;
  }

  list.innerHTML = store.allOrgUsers.map(u => `
    <div class="chat-contact-item ${store.selectedConversationUserId === u.id ? 'active' : ''}" 
         onclick="window.chat.selectUser('${u.id}')">
      <div class="contact-avatar">${(u.full_name || u.email || "?")[0].toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(u.full_name || u.email)}</div>
        <div class="contact-status">Online</div>
      </div>
    </div>
  `).join('');
}

function renderGroups() {
  const list = document.getElementById("groupConversationList");
  if (!list) return;

  if (store.chatGroups.length === 0) {
    list.innerHTML = '<div style="padding:10px 20px; font-size:11px; color:#94a3b8;">No groups available.</div>';
    return;
  }

  list.innerHTML = store.chatGroups.map(g => `
    <div class="chat-contact-item ${store.selectedGroupId === g.id ? 'active' : ''}" 
         onclick="window.chat.selectGroup('${g.id}')">
      <div class="contact-avatar group">#</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(g.name)}</div>
      </div>
    </div>
  `).join('');
}

function renderMessages() {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  
  if (store.chatMessages.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #94a3b8;">No messages yet.</div>';
    return;
  }

  container.innerHTML = store.chatMessages.map(m => {
    const isMine = m.sender_id === store.currentUserId;
    const sender = isMine ? "You" : (store.allOrgUsers.find(u => u.id === m.sender_id)?.full_name || "User");
    return `
      <div class="message ${isMine ? 'mine' : 'theirs'}">
        <div class="message-sender">${escapeHtml(sender)}</div>
        <div class="message-bubble">${escapeHtml(m.content)}</div>
      </div>
    `;
  }).join('');
  
  container.scrollTop = container.scrollHeight;
}

window.chat = {
  selectUser: (id) => {
    store.selectedConversationUserId = id;
    store.selectedGroupId = null;
    renderConversationList();
    renderGroups();
    loadMessages();
    const nameEl = document.getElementById("chatHeaderName");
    const user = store.allOrgUsers.find(u => u.id === id);
    if (nameEl && user) nameEl.textContent = user.full_name || user.email;
  },
  selectGroup: (id) => {
    store.selectedGroupId = id;
    store.selectedConversationUserId = null;
    renderConversationList();
    renderGroups();
    loadMessages();
    const nameEl = document.getElementById("chatHeaderName");
    const group = store.chatGroups.find(g => g.id === id);
    if (nameEl && group) nameEl.textContent = group.name;
  },
  sendMessage
};

window.switchChatTab = (tab) => {
  const dmList = document.getElementById("dmConversationList");
  const groupList = document.getElementById("groupConversationList");
  const dmTab = document.getElementById("chatTabDM");
  const groupTab = document.getElementById("chatTabGroups");

  if (tab === 'dm') {
    dmList.style.display = "block";
    groupList.style.display = "none";
    dmTab.classList.add("active");
    groupTab.classList.remove("active");
  } else {
    dmList.style.display = "none";
    groupList.style.display = "block";
    dmTab.classList.remove("active");
    groupTab.classList.add("active");
  }
};

window.initChat = initChat;
window.loadMessages = loadMessages;
