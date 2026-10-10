'use strict';

const blockchainNetworks=[
 {id:'solana',name:'Solana',kind:'solana'},
 {id:'ethereum',name:'Ethereum',kind:'evm'},
 {id:'base',name:'Base',kind:'evm'},
 {id:'bsc',name:'BNB Chain',kind:'evm'},
 {id:'robinhood',name:'Robinhood',kind:'evm'}
];
const networkLogos={
 solana:'<path fill="#82e3bb" d="m5 5 2-2h14l-2 2H5Zm0 14 2-2h14l-2 2H5Z"/><path fill="#ad83ef" d="m5 10 2 2h14l-2-2H5Z"/>',
 ethereum:'<path fill="#c0c8ec" d="m12 2-6 10 6 3 6-3-6-10Z"/><path fill="#8395d3" d="M12 2v13l6-3-6-10Z"/><path fill="#c0c8ec" d="m6 13 6 9 6-9-6 3-6-3Z"/><path fill="#8395d3" d="M12 16v6l6-9-6 3Z"/>',
 base:'<circle cx="12" cy="12" r="10" fill="#155dfb"/><path d="M2 12h15" stroke="#fff" stroke-width="2"/>',
 bsc:'<g fill="#f0b90b"><path d="m12 2 4 4-2 2-2-2-2 2-2-2 4-4Zm0 20-4-4 2-2 2 2 2-2 2 2-4 4ZM2 12l4-4 2 2-2 2 2 2-2 2-4-4Zm20 0-4 4-2-2 2-2-2-2 2-2 4 4Z"/><path d="m12 8 4 4-4 4-4-4 4-4Z"/></g>',
 robinhood:'<path fill="#b6f477" d="M20 2c-5 0-10 2-12 6L4 21l3-2 3-8 4-1-2 4 4-2 2-5-4 1 6-6Z"/><path d="m7 18 9-12" stroke="#112014" stroke-width="1"/>'
};
function networkLogo(id){return `<svg class="network-logo" viewBox="0 0 24 24" aria-hidden="true">${networkLogos[id]||''}</svg>`;}
let selectedBlockchain='solana';
try{const saved=localStorage.getItem('easykripto.network');if(blockchainNetworks.some(n=>n.id===saved))selectedBlockchain=saved;}catch{}
function currentNetwork(){return blockchainNetworks.find(n=>n.id===selectedBlockchain);}
function validChainAddress(address,chain=selectedBlockchain){return chain==='solana'?validAddress(address):/^0x[0-9a-fA-F]{40}$/.test(address);}
function availableWallets(){return state.wallets.filter(w=>w.chain===selectedBlockchain);}
function equalChainAddress(a,b,chain=selectedBlockchain){return chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase();}
const networkLabel=document.createElement('div');networkLabel.className='network-picker';
networkLabel.innerHTML='<select id="network-select" hidden aria-hidden="true" tabindex="-1">'+blockchainNetworks.map(n=>`<option value="${n.id}">${n.name}</option>`).join('')+'</select><button id="network-trigger" type="button" class="network-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="network-options"></button><div id="network-options" class="network-options" role="listbox" aria-label="Pilih jaringan blockchain" hidden>'+blockchainNetworks.map(n=>`<button type="button" role="option" tabindex="-1" data-network="${n.id}" aria-selected="false">${networkLogo(n.id)}<span>${n.name}</span><span class="network-check" aria-hidden="true">✓</span></button>`).join('')+'</div>';
document.querySelector('.topbar-actions').prepend(networkLabel);
document.getElementById('network-select').value=selectedBlockchain;
const networkTrigger=document.getElementById('network-trigger');
const networkOptions=document.getElementById('network-options');
function updateNetworkPicker(){
 const network=currentNetwork();networkTrigger.innerHTML=`${networkLogo(network.id)}<span>${network.name}</span><svg class="network-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
 networkTrigger.setAttribute('aria-label',`Jaringan ${network.name}. Pilih jaringan blockchain`);
 networkOptions.querySelectorAll('[data-network]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.network===network.id)));
}
function closeNetworkPicker(restoreFocus=false){networkOptions.hidden=true;networkTrigger.setAttribute('aria-expanded','false');if(restoreFocus)networkTrigger.focus();}
function openNetworkPicker(){networkOptions.hidden=false;networkTrigger.setAttribute('aria-expanded','true');networkOptions.querySelector(`[data-network="${selectedBlockchain}"]`).focus();}
networkTrigger.addEventListener('click',()=>networkOptions.hidden?openNetworkPicker():closeNetworkPicker(true));
networkOptions.addEventListener('click',event=>{const button=event.target.closest('[data-network]');if(!button)return;const select=document.getElementById('network-select');select.value=button.dataset.network;select.dispatchEvent(new Event('change'));closeNetworkPicker(true);});
networkLabel.addEventListener('keydown',event=>{
 if(event.key==='Escape'){closeNetworkPicker(true);return;}
 if(event.target===networkTrigger&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openNetworkPicker();return;}
 if(networkOptions.hidden)return;
 const options=[...networkOptions.querySelectorAll('[data-network]')],index=options.indexOf(document.activeElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}
 if(event.key==='Tab')closeNetworkPicker();
});
document.addEventListener('click',event=>{if(!networkLabel.contains(event.target))closeNetworkPicker();});
networkLabel.addEventListener('focusout',event=>{if(!networkLabel.contains(event.relatedTarget))closeNetworkPicker();});
updateNetworkPicker();
function renderNetwork(){
 const network=currentNetwork(),solana=network.id==='solana';
 const eyebrow=document.querySelector('.page-heading .eyebrow');eyebrow.textContent=`${network.name.toUpperCase()} EXPLORER`;
 document.querySelector('.sidebar-bottom').innerHTML=`${networkLogo(network.id)} ${network.name} <span class="muted">/ jaringan</span>`;
 updateNetworkPicker();
 document.querySelector('.token-section').hidden=false;document.querySelector('.right-column').hidden=false;
 renderSummary();renderActivities();renderWallets();renderMap();
 window.dispatchEvent(new CustomEvent('easykripto-network',{detail:{chain:network.id}}));
}
document.getElementById('network-select').addEventListener('change',event=>{
 selectedBlockchain=event.target.value;try{localStorage.setItem('easykripto.network',selectedBlockchain);}catch{}
 if(document.getElementById('detail-dialog').open)closeDialog();state.zoom=1;state.x=state.y=0;renderNetwork();
});
document.addEventListener('DOMContentLoaded',renderNetwork);
