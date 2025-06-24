// --- ĐỊNH NGHĨA CÁC HẰNG SỐ CỦA GAME ---
const SUITS = { "♠": 0, "♣": 1, "♦": 2, "♥": 3 };
const RANKS = { "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 5, "9": 6, "10": 7, "J": 8, "Q": 9, "K": 10, "A": 11, "2": 12 };
const RANK_NAMES = Object.keys(RANKS);

// --- LỚP LÁ BÀI (CARD) ---
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = RANKS[rank] * 4 + SUITS[suit];
        this.selected = false;
    }
    getHTML() { /* ... function from previous example ... */ 
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        cardDiv.dataset.value = this.value;
        const valueSpan = document.createElement('span');
        valueSpan.classList.add('value');
        valueSpan.innerText = this.rank;
        const suitSpan = document.createElement('span');
        suitSpan.classList.add('suit');
        suitSpan.innerText = this.suit;
        if (this.suit === '♥' || this.suit === '♦') { cardDiv.style.color = 'red'; }
        cardDiv.appendChild(valueSpan);
        cardDiv.appendChild(suitSpan);
        return cardDiv;
    }
}

// --- LỚP NGƯỜI CHƠI ---
class Player {
    constructor(id, isHuman = false) {
        this.id = id;
        this.hand = [];
        this.isHuman = isHuman;
        this.passed = false;
    }
    sortHand() { this.hand.sort((a, b) => a.value - b.value); }
}

// --- LỚP GAME CHÍNH ---
class Game {
    constructor() {
        this.players = [new Player(0, true), new Player(1), new Player(2), new Player(3)];
        this.deck = [];
        this.lastPlayedHand = null;
        this.currentPlayerIndex = -1;
        this.roundStarterIndex = -1;
        this.gameOver = false;

        this.playBtn = document.getElementById('play-btn');
        this.passBtn = document.getElementById('pass-btn');
        this.sortBtn = document.getElementById('sort-btn');
        this.startBtn = document.getElementById('start-game-btn');
        
        this.startBtn.addEventListener('click', () => this.start());
        this.playBtn.addEventListener('click', () => this.humanPlay());
        this.passBtn.addEventListener('click', () => this.humanPass());
        this.sortBtn.addEventListener('click', () => {
            this.players[0].sortHand();
            this.renderPlayerHand();
        });
    }

    start() {
        this.gameOver = false;
        this.startBtn.style.display = 'none';
        this.deck = [];
        for (const suit in SUITS) {
            for (const rank in RANKS) {
                this.deck.push(new Card(suit, rank));
            }
        }
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        this.players.forEach(p => { p.hand = []; p.passed = false; });
        let firstTurnPlayer = -1;
        for(let i = 0; i < 52; i++) {
            const player = this.players[i % 4];
            const card = this.deck[i];
            player.hand.push(card);
            if (card.rank === '3' && card.suit === '♠') {
                firstTurnPlayer = player.id;
            }
        }
        this.players.forEach(p => p.sortHand());
        this.lastPlayedHand = null;
        this.currentPlayerIndex = firstTurnPlayer;
        this.roundStarterIndex = firstTurnPlayer;
        this.renderAll();
        this.processTurn();
    }
    
    // -- QUẢN LÝ LƯỢT CHƠI VÀ VÒNG CHƠI --
    processTurn() {
        if (this.gameOver) return;
        this.updateActivePlayerUI();
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.updateMessage(`Đến lượt của ${currentPlayer.isHuman ? 'bạn' : 'Player ' + (currentPlayer.id + 1)}.`);

        if (currentPlayer.isHuman) {
            this.playBtn.disabled = false;
            this.passBtn.disabled = this.lastPlayedHand === null;
        } else {
            this.playBtn.disabled = true;
            this.passBtn.disabled = true;
            setTimeout(() => this.aiMakeMove(), 2000); // AI suy nghĩ trong 2 giây
        }
    }

    nextTurn() {
        let nextPlayerIndex = this.currentPlayerIndex;
        let activePlayers = this.players.filter(p => p.hand.length > 0 && !p.passed);

        // Nếu chỉ còn 1 người chưa bỏ lượt, vòng chơi kết thúc
        if (activePlayers.length <= 1 && this.lastPlayedHand !== null) {
            this.newRound();
            return;
        }

        // Tìm người chơi tiếp theo chưa bỏ lượt
        do {
            nextPlayerIndex = (nextPlayerIndex + 1) % 4;
        } while (this.players[nextPlayerIndex].passed || this.players[nextPlayerIndex].hand.length === 0);
        
        this.currentPlayerIndex = nextPlayerIndex;
        this.processTurn();
    }

    newRound() {
        this.updateMessage(`Vòng chơi kết thúc. ${this.lastPlayedHand.playerName} thắng vòng và đi trước.`);
        this.currentPlayerIndex = this.lastPlayedHand.playerID;
        this.roundStarterIndex = this.currentPlayerIndex;
        this.lastPlayedHand = null;
        this.players.forEach(p => p.passed = false);
        document.getElementById('last-played-hand').innerHTML = '';
        setTimeout(() => this.processTurn(), 2000);
    }

    // -- HÀNH ĐỘNG CỦA NGƯỜI CHƠI --
    humanPlay() {
        const selectedCards = this.players[0].hand.filter(c => c.selected);
        if (selectedCards.length === 0) return;

        const combination = this.analyzeCombination(selectedCards);
        if (combination.type === 'invalid') {
            this.updateMessage("Bộ bài không hợp lệ!");
            return;
        }

        if (this.isValidPlay(combination)) {
            this.executePlay(this.players[0], selectedCards, combination);
        } else {
            this.updateMessage("Không thể đánh bộ này!");
        }
    }

    humanPass() {
        this.players[0].passed = true;
        this.updateMessage("Bạn đã bỏ lượt.");
        this.nextTurn();
    }
    
    // -- LOGIC CỦA MÁY (AI) --
    aiMakeMove() {
        const aiPlayer = this.players[this.currentPlayerIndex];
        const possibleMoves = this.findAllPlayableMoves(aiPlayer);

        if (possibleMoves.length > 0) {
            // Chiến lược: Chơi bộ bài yếu nhất có thể
            const bestMove = possibleMoves[0]; // Mảng đã được sắp xếp từ yếu đến mạnh
            this.executePlay(aiPlayer, bestMove.cards, bestMove);
        } else {
            // Bỏ lượt
            aiPlayer.passed = true;
            this.updateMessage(`Player ${aiPlayer.id + 1} bỏ lượt.`);
            this.nextTurn();
        }
    }

    findAllPlayableMoves(player) {
        const allCombos = [];
        const hand = player.hand;

        // Tìm tất cả các bộ (rác, đôi, sám, tứ quý)
        const rankGroups = {};
        hand.forEach(card => {
            if (!rankGroups[card.rank]) rankGroups[card.rank] = [];
            rankGroups[card.rank].push(card);
        });

        for (const rank in rankGroups) {
            const group = rankGroups[rank];
            if (group.length >= 1) allCombos.push(this.analyzeCombination([group[0]])); // Rác
            if (group.length >= 2) allCombos.push(this.analyzeCombination(group.slice(0, 2))); // Đôi
            if (group.length >= 3) allCombos.push(this.analyzeCombination(group.slice(0, 3))); // Sám
            if (group.length >= 4) allCombos.push(this.analyzeCombination(group)); // Tứ quý
        }

        // Tìm tất cả các sảnh
        const suitGroups = {};
        hand.forEach(card => {
            if (!suitGroups[card.suit]) suitGroups[card.suit] = [];
            suitGroups[card.suit].push(card);
        });
        for (const suit in suitGroups) {
            const cardsInSuit = suitGroups[suit];
            if (cardsInSuit.length < 3) continue;
            for (let i = 0; i <= cardsInSuit.length - 3; i++) {
                for (let j = 3; j <= cardsInSuit.length - i; j++) {
                    const potentialStraight = cardsInSuit.slice(i, i + j);
                    const combo = this.analyzeCombination(potentialStraight);
                    if (combo.type === 'straight') {
                        allCombos.push(combo);
                    }
                }
            }
        }
        
        // Lọc ra những bộ có thể đánh được và sắp xếp từ yếu đến mạnh
        return allCombos
            .filter(combo => this.isValidPlay(combo))
            .sort((a, b) => a.value - b.value);
    }
    
    // -- CÁC HÀM LOGIC CỐT LÕI --
    executePlay(player, cards, combination) {
        // Cập nhật tay bài của người chơi
        player.hand = player.hand.filter(cardInHand => !cards.find(playedCard => playedCard.value === cardInHand.value));
        cards.forEach(c => c.selected = false);

        this.lastPlayedHand = { ...combination, playerID: player.id, playerName: player.isHuman ? 'Bạn' : `Player ${player.id + 1}` };
        
        // Reset trạng thái bỏ lượt của tất cả người chơi
        this.players.forEach(p => p.passed = false);
        
        this.renderAll();
        this.updateMessage(`${this.lastPlayedHand.playerName} đã đánh ${combination.type} ${combination.cards.map(c=>c.rank+c.suit).join(' ')}`);
        
        // Kiểm tra thắng
        if (player.hand.length === 0) {
            this.gameOver = true;
            this.updateMessage(`GAME OVER! ${this.lastPlayedHand.playerName} đã thắng!`);
            this.startBtn.style.display = 'block';
            this.startBtn.innerText = 'Chơi Lại';
            this.playBtn.disabled = true;
            this.passBtn.disabled = true;
            return;
        }
        this.nextTurn();
    }
    
    isValidPlay(combination) {
        if (this.lastPlayedHand === null) return true;

        const lastCombo = this.lastPlayedHand;
        
        // Luật chặt đặc biệt: Tứ quý chặt Heo
        if (combination.type === 'four_of_a_kind' && lastCombo.type === 'single' && lastCombo.cards[0].rank === '2') {
            return true;
        }

        if (combination.type !== lastCombo.type) return false;
        if (combination.type === 'straight' && combination.length !== lastCombo.length) return false;
        
        return combination.value > lastCombo.value;
    }
    
    analyzeCombination(cards) { /* ... function from previous example, no changes needed ... */ 
        const n = cards.length;
        if (n === 0) return { type: 'invalid' };
        cards.sort((a,b) => a.value - b.value);
        const highestCard = cards[n-1];
        if (n === 1) return { type: 'single', cards, value: highestCard.value, length: 1};
        const isSameRank = cards.every(c => c.rank === cards[0].rank);
        if (isSameRank) {
            if (n === 2) return { type: 'pair', cards, value: highestCard.value, length: 2 };
            if (n === 3) return { type: 'trio', cards, value: highestCard.value, length: 3 };
            if (n === 4) return { type: 'four_of_a_kind', cards, value: highestCard.value, length: 4 };
        }
        let isStraight = n >= 3 && cards.every(c => c.suit === cards[0].suit);
        if (isStraight) {
            for (let i = 0; i < n - 1; i++) {
                if (RANKS[cards[i+1].rank] - RANKS[cards[i].rank] !== 1) {
                    isStraight = false; break;
                }
            }
            if (isStraight) return { type: 'straight', cards, value: highestCard.value, length: n };
        }
        return { type: 'invalid' };
    }

    // -- CÁC HÀM HIỂN THỊ (RENDER) --
    renderAll() {
        this.renderPlayerHand();
        this.players.forEach(p => { if(!p.isHuman) this.renderOpponentHand(p) });
        this.renderLastPlayedHand();
        this.updateActivePlayerUI();
    }
    renderPlayerHand() {
        const handDiv = document.querySelector('#player-0 .hand');
        handDiv.innerHTML = '';
        this.players[0].hand.forEach(card => {
            const cardElement = card.getHTML();
            if (card.selected) cardElement.classList.add('selected');
            cardElement.addEventListener('click', () => {
                if (this.players[this.currentPlayerIndex].isHuman) {
                    card.selected = !card.selected;
                    this.renderPlayerHand();
                }
            });
            handDiv.appendChild(cardElement);
        });
    }
    renderOpponentHand(player) {
        document.querySelector(`#player-${player.id} .card-count`).innerText = `${player.hand.length} lá`;
    }
    renderLastPlayedHand() {
        const area = document.getElementById('last-played-hand');
        area.innerHTML = '';
        if (this.lastPlayedHand) {
            this.lastPlayedHand.cards.forEach(c => area.appendChild(c.getHTML()));
        }
    }
    updateMessage(msg) { document.getElementById('message-box').innerText = msg; }
    updateActivePlayerUI() {
        this.players.forEach(p => {
            const playerDiv = document.getElementById(`player-${p.id}`);
            if (p.id === this.currentPlayerIndex && !this.gameOver) {
                playerDiv.classList.add('active');
            } else {
                playerDiv.classList.remove('active');
            }
        });
    }
}

window.onload = () => new Game();
