// ==================== MANAJEMEN PEMAIN ====================
async function loadPlayers() {
    showLoading();
    try {
        const result = await callAPI('getPlayers');
        let list = [];
        if (result) {
            if (Array.isArray(result.players)) list = result.players;
            else if (Array.isArray(result.data?.players)) list = result.data.players;
            else if (Array.isArray(result.data)) list = result.data;
            else if (Array.isArray(result)) list = result;
        }

        players = list.map(p => {
            if (typeof p === 'string') return { name: p, photo: null };
            if (p && typeof p === 'object') return { 
                name: p.name || p.playerName || p.username || String(p.id || '') || JSON.stringify(p),
                photo: p.photo || null 
            };
            return { name: String(p), photo: null };
        }).filter(p => p.name);

        players.sort((a, b) => a.name.localeCompare(b.name));
        renderPlayers();
    } catch (err) {
        console.error('Failed to load players:', err);
    } finally {
        hideLoading();
    }
}

function renderPlayers(searchTerm) {
    const container = document.getElementById('players-list');
    if (!container) return;
    
    const query = (searchTerm !== undefined ? searchTerm : ((document.getElementById('player-search') || {}).value || '')).trim().toLowerCase();
    const visiblePlayers = players.filter(player => !query || player.name.toLowerCase().includes(query));
    container.innerHTML = '';

    if (visiblePlayers.length === 0) {
        container.innerHTML = '<div class="player-search-empty">Tidak ada pemain yang cocok.</div>';
        return;
    }
    
    visiblePlayers.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card-with-photo';
        
        playerCard.innerHTML = `
            <div class="player-photo-indicator ${player.photo ? '' : 'default'}" onclick="openPhotoModal('${player.name}')">
                ${player.photo ? 
                    `<img src="uploads/player_photos/${player.photo}" alt="${player.name}" onerror="this.onerror=null; this.parentElement.className='player-photo-indicator default'; this.parentElement.innerHTML='👤';">` : 
                    '👤'
                }
            </div>
            <div class="player-card-name">
                <h4>${player.name}</h4>
            </div>
            <div class="player-card-actions">
                <button class="btn btn-small player-edit-btn" onclick="openPhotoModal('${player.name}')" title="Edit pemain">
                    <span style="font-size: 1rem;">✏️</span> Edit
                </button>
            </div>
        `;
        container.appendChild(playerCard);
    });
}

function filterPlayers(searchTerm) {
    renderPlayers(searchTerm);
}

async function removePlayer(playerName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus pemain "${playerName}"?`)) {
        return;
    }

    showLoading();
    try {
        const result = await callAPI('removePlayer', { playerName });
        if (result && result.success) {
            players = players.filter(p => p.name !== playerName);
            renderPlayers();
            
            alert(`Pemain "${playerName}" berhasil dihapus!`);
            
            await updateLeaderboard();
            if (matchData) {
                renderTeams(matchData.teams, matchData.cancelOnDay);
            }
        } else {
            const err = (result && result.error) ? result.error : 'Gagal menghapus pemain';
            alert(err);
        }
    } catch (err) {
        console.error('Failed to remove player:', err);
        alert('Terjadi kesalahan saat menghapus pemain');
    } finally {
        hideLoading();
    }
}

// ==================== FUNGSI UPLOAD FOTO DENGAN CROP ====================
var selectedPlayerForPhoto = '';
var selectedPhotoFile = null;
var croppedBlob = null;
var cropperInstance = null;

function openPhotoModal(playerName) {
    selectedPlayerForPhoto = playerName;
    selectedPhotoFile = null;
    croppedBlob = null;
    
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '<div class="photo-preview default"><span>👤</span></div>';
    document.getElementById('photoInput').value = '';
    
    document.getElementById('modalPlayerName').textContent = `Edit Pemain: ${playerName}`;
    document.getElementById('editPlayerName').value = playerName;
    
    // Show select mode, hide crop mode
    document.getElementById('photoModalSelectMode').style.display = 'block';
    document.getElementById('photoModalCropMode').style.display = 'none';
    
    const player = players.find(p => p.name === playerName);
    if (player && player.photo) {
        const previewImg = document.createElement('img');
        previewImg.src = `uploads/player_photos/${player.photo}?t=${Date.now()}`;
        previewImg.alt = playerName;
        previewImg.onerror = function() {
            this.onerror = null;
            preview.innerHTML = '<div class="photo-preview default"><span>👤</span></div>';
        };
        preview.innerHTML = '';
        preview.appendChild(previewImg);
    }
        // Show or hide Edit button depending on whether player already has photo
        var editBtn = document.getElementById('editPhotoBtn');
        if (editBtn) {
            editBtn.style.display = (player && player.photo) ? 'inline-flex' : 'none';
        }
    
    document.getElementById('photoModal').style.display = 'flex';
}

function closePhotoModal() {
    document.getElementById('photoModal').style.display = 'none';
    selectedPlayerForPhoto = '';
    selectedPhotoFile = null;
    croppedBlob = null;
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
}

function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
        event.target.value = '';
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB');
        event.target.value = '';
        return;
    }
    
    selectedPhotoFile = file;
    croppedBlob = null;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Switch to crop mode
        document.getElementById('photoModalSelectMode').style.display = 'none';
        document.getElementById('photoModalCropMode').style.display = 'block';
        
        const cropperImg = document.getElementById('cropperImage');
        cropperImg.src = e.target.result;
        
        // Destroy existing cropper if any
        if (cropperInstance) {
            cropperInstance.destroy();
        }
        
        // Initialize cropper with 1:1 aspect ratio
        cropperInstance = new Cropper(cropperImg, {
            aspectRatio: 1 / 1,
            viewMode: 1,
            autoCropArea: 0.8,
            responsive: true,
            restore: true,
            guides: true,
            center: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
            crop: updateCropPreview
        });
    };
    reader.readAsDataURL(file);
}

function updateCropPreview() {
    if (!cropperInstance) return;
    
    const canvas = cropperInstance.getCroppedCanvas({
        maxWidth: 300,
        maxHeight: 300,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    
    const previewImg = document.getElementById('cropPreviewImage');
    previewImg.src = canvas.toDataURL();
}

function resetCrop() {
    if (cropperInstance) {
        cropperInstance.reset();
        updateCropPreview();
    }
}

function confirmCrop() {
    if (!cropperInstance) {
        alert('Tidak ada gambar untuk di-crop');
        return;
    }
    
    const canvas = cropperInstance.getCroppedCanvas({
        maxWidth: 1200,
        maxHeight: 1200,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    
        canvas.toBlob(function(blob) {
            croppedBlob = blob;

            // Create a File object from the blob. If editing existing photo, use player name as filename.
            var baseName = selectedPhotoFile && selectedPhotoFile.name ? selectedPhotoFile.name : (selectedPlayerForPhoto ? selectedPlayerForPhoto.replace(/[^a-z0-9]/gi, '_') + '.jpg' : 'cropped.jpg');
            const croppedFile = new File([blob], 'cropped_' + baseName, { type: 'image/jpeg' });
            selectedPhotoFile = croppedFile;

            // Go back to select mode
            backToSelectMode();
        }, 'image/jpeg', 0.9);
    }

    // Edit existing uploaded photo: load it into cropper for resizing/cropping
    function editCurrentPhoto() {
        if (!selectedPlayerForPhoto) {
            alert('Pilih pemain terlebih dahulu!');
            return;
        }

        const player = players.find(p => p.name === selectedPlayerForPhoto);
        if (!player || !player.photo) {
            alert('Pemain belum memiliki foto untuk diedit.');
            return;
        }

        // Prepare crop mode
        document.getElementById('photoModalSelectMode').style.display = 'none';
        document.getElementById('photoModalCropMode').style.display = 'block';

        const cropperImg = document.getElementById('cropperImage');
        // Use timestamp query to bust cache
        cropperImg.src = `uploads/player_photos/${player.photo}?t=${Date.now()}`;

        // Destroy existing cropper if any
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }

        // Initialize cropper after image loads
        cropperImg.onload = function() {
            cropperInstance = new Cropper(cropperImg, {
                aspectRatio: 1 / 1,
                viewMode: 1,
                autoCropArea: 0.8,
                responsive: true,
                restore: true,
                guides: true,
                center: true,
                highlight: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: true,
                crop: updateCropPreview
            });
        };

        // Ensure selectedPhotoFile cleared; we'll create new file on confirmCrop
        selectedPhotoFile = null;
        croppedBlob = null;
}

function backToSelectMode() {
    document.getElementById('photoModalSelectMode').style.display = 'block';
    document.getElementById('photoModalCropMode').style.display = 'none';
    
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    
    // Update preview with cropped image
    if (croppedBlob) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('photoPreview');
            preview.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            preview.appendChild(img);
        };
        reader.readAsDataURL(croppedBlob);
    }
}

async function uploadPhoto() {
    if (!selectedPlayerForPhoto) {
        alert('Pilih pemain terlebih dahulu!');
        return;
    }
    
    if (!selectedPhotoFile) {
        alert('Pilih file foto terlebih dahulu!');
        return;
    }
    
    const formData = new FormData();
    formData.append('action', 'uploadPlayerPhoto');
    formData.append('playerName', selectedPlayerForPhoto);
    formData.append('photo', selectedPhotoFile);
    
    showLoading();
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Foto berhasil diupload!');
            
            const playerIndex = players.findIndex(p => p.name === selectedPlayerForPhoto);
            if (playerIndex !== -1) {
                players[playerIndex].photo = result.photo;
            }
            
            renderPlayers();
            closePhotoModal();
            
            if (matchData) {
                renderTeams(matchData.teams, matchData.cancelOnDay);
            }
        } else {
            alert('Gagal upload foto: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Terjadi kesalahan saat upload foto');
    } finally {
        hideLoading();
    }
}

async function deletePlayerPhoto() {
    if (!selectedPlayerForPhoto) {
        alert('Pilih pemain terlebih dahulu!');
        return;
    }
    
    if (!confirm(`Hapus foto untuk pemain "${selectedPlayerForPhoto}"?`)) {
        return;
    }
    
    showLoading();
    try {
        const result = await callAPI('deletePlayerPhoto', { 
            playerName: selectedPlayerForPhoto 
        });
        
        if (result.success) {
            alert('Foto berhasil dihapus!');
            
            const playerIndex = players.findIndex(p => p.name === selectedPlayerForPhoto);
            if (playerIndex !== -1) {
                players[playerIndex].photo = null;
            }
            
            renderPlayers();
            closePhotoModal();
            
            if (matchData) {
                renderTeams(matchData.teams, matchData.cancelOnDay);
            }
        } else {
            alert('Gagal menghapus foto: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Delete photo error:', error);
        alert('Terjadi kesalahan saat menghapus foto');
    } finally {
        hideLoading();
    }
}
async function addPlayer() {
    var input = document.getElementById('new-player');
    var name = input.value.trim();
    if (!name) {
        alert('Nama pemain tidak boleh kosong!');
        return;
    }

    showLoading();
    try {
        var result = await callAPI('addPlayer', { playerName: name });
        if (result && result.success) {
            players.push({ name: name, photo: null });
            players.sort(function(a, b) { return a.name.localeCompare(b.name); });
            renderPlayers();
            
            input.value = '';
            alert('Pemain "' + name + '" berhasil ditambahkan!');
            
            // Refresh daftar pemain di shuffle
            refreshShufflePlayerList();
            
            if (matchData) {
                renderTeams(matchData.teams, matchData.cancelOnDay);
            }
        } else {
            var err = (result && result.error) ? result.error : 'Gagal menambahkan pemain';
            alert(err);
        }
    } catch (err) {
        console.error('Failed to add player:', err);
        alert('Terjadi kesalahan saat menambahkan pemain');
    } finally {
        hideLoading();
    }
}

async function savePlayerName() {
    var oldName = selectedPlayerForPhoto;
    var newName = document.getElementById('editPlayerName').value.trim();
    if (!oldName || !newName) { alert('Nama pemain tidak boleh kosong!'); return; }
    if (oldName === newName) { alert('Nama pemain tidak berubah.'); return; }

    showLoading();
    try {
        var result = await callAPI('renamePlayer', { oldName: oldName, newName: newName });
        if (!result || !result.success) throw new Error((result && result.error) || 'Gagal mengubah nama pemain');
        var player = players.find(function(item) { return item.name === oldName; });
        if (player) player.name = newName;
        players.sort(function(a, b) { return a.name.localeCompare(b.name); });
        selectedPlayerForPhoto = newName;
        document.getElementById('modalPlayerName').textContent = 'Edit Pemain: ' + newName;
        renderPlayers();
        await updateLeaderboard();
        if (typeof refreshShufflePlayerList === 'function') refreshShufflePlayerList();
        if (matchData) await loadMatchData(true);
        alert('Nama pemain berhasil diubah!');
    } catch (error) {
        alert(error.message);
    } finally { hideLoading(); }
}

async function deleteEditedPlayer() {
    var playerName = selectedPlayerForPhoto;
    if (!playerName) return;
    closePhotoModal();
    await removePlayer(playerName);
}
