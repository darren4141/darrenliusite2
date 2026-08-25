let activeNodeId = null;

function openNode(id) {
    const modal = document.getElementById('modal-' + id);
    if (!modal) return;
    modal.hidden = false;
    modal.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    activeNodeId = id;
    const closeBtn = modal.querySelector('.node-modal__close');
    if (closeBtn) closeBtn.focus();
}

function closeNode(id) {
    const modal = document.getElementById('modal-' + id);
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (activeNodeId === id) activeNodeId = null;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeNodeId) {
        closeNode(activeNodeId);
    }
});
