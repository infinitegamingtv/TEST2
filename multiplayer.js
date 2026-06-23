// Cấu hình Firebase của bạn
const firebaseConfig = {
    apiKey: "AIzaSyB7GEG6gSDRBxKFmuo0iG_wt-IsTaDyHWU",
    authDomain: "test-aa50d.firebaseapp.com",
    projectId: "test-aa50d",
    storageBucket: "test-aa50d.firebasestorage.app",
    messagingSenderId: "160629020295",
    appId: "1:160629020295:web:d2d3e98690b729a7f68a22",
    databaseURL: "https://test-aa50d-default-rtdb.firebaseio.com"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

class MultiplayerSystem {
    constructor() {
        this.currentRoomId = null;
        this.currentPlayerName = null;
        this.roomRef = null;
        this.onLeaderboardUpdate = null;
        this.onGameStarted = null;
        this.isTeacher = false;
    }

    // Sinh mã phòng ngẫu nhiên 5 ký tự
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    createRoom() {
        return new Promise((resolve) => {
            const roomId = this.generateRoomCode();
            const roomRef = db.ref('rooms/' + roomId);
            
            roomRef.set({
                status: 'waiting',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                this.isTeacher = true;
                this.currentRoomId = roomId;
                this.roomRef = roomRef;
                
                // Lắng nghe học sinh vào phòng
                roomRef.child('players').on('value', (snap) => {
                    if (this.onLeaderboardUpdate) {
                        const data = snap.val() || {};
                        const leaderboard = Object.keys(data).map(name => ({
                            name: name,
                            score: data[name].score
                        })).sort((a, b) => b.score - a.score);
                        
                        this.onLeaderboardUpdate(leaderboard);
                    }
                });

                resolve({ success: true, roomId: roomId });
            }).catch((error) => {
                if (error.code === 'PERMISSION_DENIED') {
                    resolve({ success: false, message: 'Lỗi: Chưa mở khóa Database (Rules = true).' });
                } else {
                    resolve({ success: false, message: 'Lỗi Firebase: ' + error.message });
                }
            });
        });
    }

    startGame() {
        if (this.isTeacher && this.roomRef) {
            this.roomRef.update({ status: 'playing' });
        }
    }

    joinRoom(playerName, roomId) {
        return new Promise((resolve) => {
            const roomRef = db.ref('rooms/' + roomId);
            
            roomRef.once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    resolve({ success: false, message: 'Phòng không tồn tại. Vui lòng hỏi lại giáo viên mã phòng!' });
                    return;
                }

                const roomData = snapshot.val();
                if (roomData.status !== 'waiting') {
                    resolve({ success: false, message: 'Phòng đã bắt đầu chơi, không thể vào được nữa!' });
                    return;
                }

                const players = roomData.players || {};
                const playerNames = Object.keys(players);
                
                // Giới hạn 40 người cho 1 lớp
                if (playerNames.length >= 40 && !players[playerName]) {
                    resolve({ success: false, message: 'Phòng đã đầy.' });
                    return;
                }

                // Lưu thông tin người chơi hiện tại
                this.isTeacher = false;
                this.currentRoomId = roomId;
                this.currentPlayerName = playerName;
                this.roomRef = db.ref('rooms/' + roomId);

                // Thêm người chơi vào DB
                if (!players[playerName]) {
                    this.roomRef.child('players/' + playerName).set({
                        score: 0,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    }).catch(err => console.error("Write error:", err));
                }

                // Lắng nghe trạng thái phòng để biết khi nào bắt đầu
                this.roomRef.child('status').on('value', (snap) => {
                    const status = snap.val();
                    if (status === 'playing' && this.onGameStarted) {
                        this.onGameStarted();
                    }
                });

                resolve({ success: true });
            }, (error) => {
                if (error.code === 'PERMISSION_DENIED') {
                    resolve({ success: false, message: 'Lỗi: Bạn chưa làm BƯỚC 3 (Đổi luật Rules thành true) trên Firebase.' });
                } else {
                    resolve({ success: false, message: 'Lỗi kết nối Firebase: ' + error.message });
                }
            });
        });
    }

    updateScore(score) {
        if (this.isTeacher) return; // Giáo viên chỉ quan sát
        if (!this.currentRoomId || !this.currentPlayerName) return;

        const playerRef = this.roomRef.child('players/' + this.currentPlayerName);
        playerRef.once('value', (snapshot) => {
            const currentData = snapshot.val();
            // Chỉ cập nhật lên server nếu điểm mới cao hơn điểm cũ
            if (!currentData || score > currentData.score) {
                playerRef.update({ score: score }).catch(err => console.error(err));
            }
        });
    }

    leaveRoom() {
        if (this.roomRef) {
            this.roomRef.child('players').off();
            this.roomRef.child('status').off();
        }
        this.currentRoomId = null;
        this.currentPlayerName = null;
        this.roomRef = null;
        this.isTeacher = false;
    }
}

const multiplayer = new MultiplayerSystem();
