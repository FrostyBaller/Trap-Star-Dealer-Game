document.addEventListener('DOMContentLoaded', () => {
    // Game state
    const initialState = {
        money: 200, // Slightly more for realism
        reputation: 0,
        heat: 0,
        smell: 0,
        electricity: 0,
        lastBillDate: Date.now(),
        // DRUGS
        wetGrams: 0,
        dryGrams: 0,
        packagedBags: 0,
        preRolls: 0, // NEW
        meth: 0,
        crack: 0,
        heroin: 0,
        dmt: 0,
        lsd: 0,
        // GUNS & GEAR
        glocks: 0,
        switches: 0,
        extMags: 0,
        drumMags: 0,
        lasers: 0,
        moddedGlocks: 0,
        // INGREDIENTS
        seeds: 5,
        poppySeeds: 0,
        pseudo: 0,
        acid: 0,
        bakingSoda: 0,
        chemicals: 0,
        solvent: 0,
        papers: 10, // NEW
        // SYSTEM
        activeTool: 'plant',
        pruneEfficiency: 5,
        scaleWeight: 0,
        currentStation: 'grow',
        cryptoPrice: 0.15,
        cryptoOwned: 0,
        bankHistory: [],
        currentStrainIndex: 0,
        strains: [
            { name: 'OG Haze', price: 60, growthFactor: 1.0, smellFactor: 1.0 },
            { name: 'Purple Punch', price: 120, growthFactor: 0.8, smellFactor: 1.5 },
            { name: 'Blue Dream', price: 180, growthFactor: 1.2, smellFactor: 2.0 },
            { name: 'Lemon Skunk', price: 250, growthFactor: 0.9, smellFactor: 2.5 },
            { name: 'Death Star', price: 400, growthFactor: 0.7, smellFactor: 4.0 }
        ],
        pots: [null, 'locked', 'locked', 'locked', 'locked', 'locked'],
        dryingBuds: [null, 'locked', 'locked'],
        ovens: [
            { id: 1, type: 'basic', status: 'idle', drug: null, progress: 0, unlocked: true },
            { id: 2, type: 'pro', status: 'idle', drug: null, progress: 0, unlocked: false },
            { id: 3, type: 'industrial', status: 'idle', drug: null, progress: 0, unlocked: false }
        ],
        orders: [],
        crypto: {
            doge: { name: 'DOGE', price: 0.15, owned: 0, history: [0.15] },
            btc: { name: 'BTC', price: 45000, owned: 0, history: [45000] },
            eth: { name: 'ETH', price: 2500, owned: 0, history: [2500] }
        },
        upgrades: {
            potLevel: 0,
            hasRails: false,
            hasProLights: false,
            hasLightsApp: false,
            hasBlackMarket: false,
            hasKitchen: false,
            hasLab: false,
            hasArmory: false,
            hasFillOrders: false,
            filterLevel: 0, // NEW
            roomLightColor: 'purple',
            unlockedPots: 1,
            unlockedDryers: 1,
            unlockedStrains: 1
        }
    };

    let state = { ...initialState };

    // PHYSICS ENGINE VARIABLES
    const physicsObjects = [];
    const gravity = 0.5;
    const friction = 0.98;
    const bounce = 0.6;
    let currentScaleWeight = 0;
    let targetScaleWeight = 0;
    let leafBeingCut = null;

    // DOM Elements
    const loadingScreen = document.getElementById('loading-screen');
    const gameUI = document.getElementById('game-ui');
    const roomsContainer = document.getElementById('rooms-container');
    const worldSlider = document.querySelector('.world-slider');
    const navTabs = document.querySelectorAll('.nav-tab');
    const phoneOverlay = document.getElementById('phone-overlay');
    const metalTable = document.getElementById('metal-table');
    const scaleDisplay = document.getElementById('scale-display');
    const cutUI = document.getElementById('cut-ui');
    const digitalScale = document.getElementById('digital-scale');

    // UI Updates
    const moneyDisplay = document.getElementById('money-display');
    const wetDisplay = document.getElementById('wet-stash');
    const dryDisplay = document.getElementById('dry-stash');
    const packagedDisplay = document.getElementById('packaged-stash');

    console.log("DOM Elements loaded:", {
        loadingScreen, gameUI, roomsContainer, worldSlider, navTabs,
        moneyDisplay, phoneOverlay, metalTable, scaleDisplay, digitalScale
    });

    // Audio (Hoodtrap)
    const bgMusic = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
    bgMusic.loop = true;

    // Phone Overlay Toggle ('P' key)
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') {
            togglePhone();
        }
    });

    function togglePhone() {
        phoneOverlay.classList.toggle('show');
        if (phoneOverlay.classList.contains('show')) {
            triggerScreenShake(50);
        }
    }

    // ARMS SWAY (RAGDOLL FEEL)
    const leftArm = document.querySelector('.left-arm');
    const rightArm = document.querySelector('.right-arm');
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 40;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        
        if (leftArm) leftArm.style.transform = `rotate(${25 + x/2}deg) translate(${x}px, ${y}px)`;
        if (rightArm) rightArm.style.transform = `rotate(${-25 + x/2}deg) translate(${x}px, ${y}px)`;
    });

    // Zoom System
    window.zoomStation = (stationId) => {
        const room = document.getElementById(`station-${stationId}`);
        if (!room) return;
        // If already zoomed, do nothing
        if (room.classList.contains('zoomed')) return;

        // Unzoom all first
        document.querySelectorAll('.room').forEach(r => {
            r.classList.remove('zoomed');
            r.classList.add('far-view');
        });
        room.classList.remove('far-view');
        room.classList.add('zoomed');
    };

    // Station Navigation with Sliding Effect
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const station = tab.dataset.station;
            if (station === state.currentStation) return;

            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Sliding animation
            worldSlider.classList.add('sliding');
            const offsets = { 
                grow: 0, 
                dry: -14.28, 
                roll: -28.57, 
                pack: -42.85, 
                kitchen: -57.14, 
                inventory: -71.42, 
                help: -85.71 
            };
            roomsContainer.style.transform = `translateX(${offsets[station]}%)`;
            
            // Auto-zoom when switching
            setTimeout(() => {
                worldSlider.classList.remove('sliding');
                state.currentStation = station;
                if (station !== 'phone' && station !== 'help' && station !== 'inventory') {
                    zoomStation(station);
                } else {
                    // Unzoom when entering non-interactive rooms
                    document.querySelectorAll('.room').forEach(r => {
                        r.classList.remove('zoomed');
                        r.classList.add('far-view');
                    });
                    const currentRoom = document.getElementById(`station-${station}`);
                    if (currentRoom) {
                        currentRoom.classList.remove('far-view');
                        currentRoom.classList.add('zoomed');
                    }
                }
                if (station === 'inventory') renderInventory();
            }, 600);
        });
    });

    // RGB Lighting System
    window.setRoomLight = (color) => {
        const fx = document.getElementById('grow-light-fx');
        if (color === 'rainbow') {
            fx.style.animation = 'rainbowCycle 5s infinite linear';
        } else {
            fx.style.animation = 'none';
            fx.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
        }
        state.upgrades.roomLightColor = color;
    };

    // Plant Class with Upgrade Logic
    class Plant {
        constructor(slotIndex) {
            this.slotIndex = slotIndex;
            this.id = Date.now() + Math.random();
            this.growth = 0;
            this.hydration = 100;
            this.nutrients = 100;
            this.ph = 6.0; // Ideal is 6.0-6.5
            this.temp = 75; // Ideal is 70-80
            this.isReady = false;
            this.stage = 1;
            this.strainIndex = state.currentStrainIndex;
            this.render();
            this.tick();
        }

        render() {
            const potClass = ['pot-rusty', 'pot-red', 'pot-black'][state.upgrades.potLevel];
            const slot = document.querySelector(`.pot-slot[data-index="${this.slotIndex}"]`);
            if (!slot) return;
            
            slot.innerHTML = `
                <div class="plant-container stage-${this.stage}">
                    <div class="plant-visual">
                        ${state.upgrades.hasRails ? '<div class="rails"></div>' : ''}
                        <div class="leaf left"></div>
                        <div class="leaf right"></div>
                        <div class="pot ${potClass}"></div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="growth-${this.id.toString().replace('.','')}"></div>
                    </div>
                    <div class="plant-needs">
                        <div class="need-bar-container"><div class="need-bar water" id="water-${this.id.toString().replace('.','')}"></div></div>
                        <div class="need-bar-container"><div class="need-bar nutrients" id="nutrients-${this.id.toString().replace('.','')}"></div></div>
                    </div>
                    <div class="env-stats">
                        <span>pH: <span id="ph-${this.id.toString().replace('.','')}">${this.ph.toFixed(1)}</span></span>
                        <span>TEMP: <span id="temp-${this.id.toString().replace('.','')}">${this.temp}</span>°</span>
                    </div>
                    <div class="harvest-indicator">READY!</div>
                </div>
            `;
            this.element = slot.querySelector('.plant-container');
            this.element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleInteraction();
            });
            this.updateBars();
        }

        handleInteraction() {
            if (state.activeTool === 'water') {
                this.hydration = Math.min(100, this.hydration + 30);
                triggerScreenShake(50);
            } else if (state.activeTool === 'harvest' && this.isReady) {
                this.harvest();
            }
            this.updateBars();
        }

        updateBars() {
            const safeId = this.id.toString().replace('.','');
            const g = document.getElementById(`growth-${safeId}`);
            const w = document.getElementById(`water-${safeId}`);
            const n = document.getElementById(`nutrients-${safeId}`);
            const p = document.getElementById(`ph-${safeId}`);
            const t = document.getElementById(`temp-${safeId}`);
            if (g) g.style.width = `${this.growth}%`;
            if (w) w.style.width = `${this.hydration}%`;
            if (n) n.style.width = `${this.nutrients}%`;
            if (p) p.textContent = this.ph.toFixed(1);
            if (t) t.textContent = Math.floor(this.temp);
        }

        tick() {
            this.interval = setInterval(() => {
                if (!state.pots[this.slotIndex] || state.pots[this.slotIndex] === 'locked') { 
                    clearInterval(this.interval); 
                    return; 
                }
                if (this.isReady) return;

                this.hydration -= 0.5;
                this.nutrients -= 0.2;
                
                // Randomly fluctuate environment
                this.ph += (Math.random() - 0.5) * 0.1;
                this.temp += (Math.random() - 0.5) * 1;

                let rate = 0.8 * state.strains[this.strainIndex].growthFactor;
                
                // Realism: Penalize for bad environment
                if (this.ph < 5.5 || this.ph > 7.0) rate *= 0.5;
                if (this.temp < 65 || this.temp > 85) rate *= 0.5;
                if (this.hydration < 10) rate *= 0.1;

                if (state.upgrades.hasProLights) rate *= 1.5;
                this.growth += rate;

                this.updateBars();
                this.updateStage();

                if (this.growth >= 100) {
                    this.growth = 100;
                    this.isReady = true;
                    if (this.element) {
                        this.element.classList.add('ready');
                        const indicator = this.element.querySelector('.harvest-indicator');
                        if (indicator) indicator.style.display = 'block';
                    }
                    clearInterval(this.interval);
                }
            }, 1000);
        }

        updateStage() {
            const s = this.growth >= 75 ? 4 : this.growth >= 45 ? 3 : this.growth >= 15 ? 2 : 1;
            if (s !== this.stage) {
                this.stage = s;
                if (this.element) {
                    this.element.className = `plant-container stage-${this.stage} ${this.isReady ? 'ready' : ''}`;
                }
            }
        }

        harvest() {
            const yieldGrams = 40 + Math.floor(Math.random() * 20);
            state.wetGrams += yieldGrams;
            state.pots[this.slotIndex] = null;
            clearInterval(this.interval);
            updateUI();
        }
    }

    function updateUI() {
        if (moneyDisplay) moneyDisplay.textContent = `$${Math.floor(state.money)}`;
        
        // Heat & Smell Displays
        const heatDisp = document.getElementById('heat-display');
        const smellDisp = document.getElementById('smell-display');
        if (heatDisp) {
            heatDisp.textContent = `${Math.floor(state.heat)}%`;
            heatDisp.style.color = state.heat > 70 ? '#ff0000' : (state.heat > 40 ? '#ffff00' : '#ffffff');
        }
        if (smellDisp) {
            smellDisp.textContent = `${Math.floor(state.smell)}%`;
            smellDisp.style.color = state.smell > 60 ? '#ff00ff' : '#ffffff';
        }

        // Dry Station Displays
        const dryWetCount = document.getElementById('dry-wet-count');
        const dryDryCount = document.getElementById('dry-dry-count');
        if (dryWetCount) dryWetCount.textContent = Math.floor(state.wetGrams);
        if (dryDryCount) dryDryCount.textContent = Math.floor(state.dryGrams);

        // Rolling Station Displays
        const rollPapers = document.getElementById('roll-papers-count');
        const rollDry = document.getElementById('roll-dry-bud-count');
        if (rollPapers) rollPapers.textContent = state.papers;
        if (rollDry) rollDry.textContent = Math.floor(state.dryGrams);

        // Update Strain Selector
        const strainSelect = document.getElementById('strain-select');
        if (strainSelect) {
            const currentVal = strainSelect.value;
            strainSelect.innerHTML = '';
            for (let i = 0; i < state.upgrades.unlockedStrains; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = state.strains[i].name;
                strainSelect.appendChild(opt);
            }
            strainSelect.value = currentVal || 0;
        }

        // Update App & Nav visibility
        const lightsBtn = document.getElementById('lights-app-btn');
        if (lightsBtn) lightsBtn.classList.toggle('hidden', !state.upgrades.hasLightsApp);
        
        const blackMarketBtn = document.getElementById('blackmarket-app-btn');
        if (blackMarketBtn) blackMarketBtn.classList.toggle('hidden', !state.upgrades.hasBlackMarket);

        const kitchenNav = document.getElementById('nav-kitchen');
        if (kitchenNav) kitchenNav.classList.toggle('hidden', !state.upgrades.hasKitchen);

        renderUpgrades();
        renderPotSlots();
        renderDrySlots();
        renderOvens();
        if (typeof renderBins === 'function') renderBins();
    }

    window.rollJoint = () => {
        if (state.dryGrams >= 1 && state.papers >= 1) {
            state.dryGrams -= 1;
            state.papers -= 1;
            const progress = document.getElementById('roll-progress');
            const bar = document.getElementById('roll-bar');
            if (progress) progress.classList.remove('hidden');
            let p = 0;
            const interval = setInterval(() => {
                p += 5;
                if (bar) bar.style.width = p + '%';
                if (p >= 100) {
                    clearInterval(interval);
                    state.preRolls++;
                    if (progress) progress.classList.add('hidden');
                    updateUI();
                    triggerScreenShake(100);
                }
            }, 100);
        } else {
            alert("Need at least 1g Dry Bud and 1 Paper!");
        }
    };

    // SIMULATION LOOP (Runs every 2 seconds)
    function runSimulation() {
        // 1. Calculate Smell
        let currentSmell = 0;
        
        // Smell from plants
        state.pots.forEach(p => {
            if (p instanceof Plant) {
                const strain = state.strains[p.strainIndex];
                currentSmell += (p.growth / 100) * 5 * strain.smellFactor;
            }
        });

        // Smell from ovens
        state.ovens.forEach(o => {
            if (o.status === 'cooking') currentSmell += 10;
        });

        // Smell from inventory
        currentSmell += (state.wetGrams / 100);

        // Filters reduce smell
        const filterReduction = state.upgrades.filterLevel * 15;
        state.smell = Math.max(0, currentSmell - filterReduction);

        // 2. Calculate Heat (Police Attention)
        let heatChange = -0.1; // Passive cool down
        
        if (state.smell > 30) heatChange += (state.smell - 30) * 0.05;
        if (state.electricity > 50) heatChange += (state.electricity - 50) * 0.1;
        
        state.heat = Math.max(0, Math.min(100, state.heat + heatChange));

        // 3. Electricity Usage
        let currentElectric = 5; // Base usage
        if (state.upgrades.hasProLights) currentElectric += 15;
        state.ovens.forEach(o => { if(o.status === 'cooking') currentElectric += 20; });
        state.electricity = currentElectric;

        // 4. Bills (Every 1 minute)
        if (Date.now() - state.lastBillDate > 60000) {
            const bill = (state.electricity * 0.5) + 50; // Rent + Electric
            state.money -= bill;
            state.lastBillDate = Date.now();
            addBankEntry(`Utility Bill & Rent paid: $${bill.toFixed(2)}`, 'negative');
            if (state.money < 0) {
                triggerScreenShake(1000);
                alert("YOU'RE IN DEBT! GET THAT CASH OR THE FEDS ARE COMING.");
            }
        }

        // 5. Raid Logic
        if (state.heat >= 100) {
            triggerRaid();
        }

        updateUI();
    }

    function triggerRaid() {
        alert("RAID! THE FEDS KICKED THE DOOR IN!");
        state.money = Math.floor(state.money * 0.5);
        state.packagedBags = 0;
        state.meth = 0;
        state.crack = 0;
        state.glocks = 0;
        state.moddedGlocks = 0;
        state.heat = 0;
        state.reputation = Math.floor(state.reputation * 0.8);
        triggerScreenShake(2000);
        updateUI();
    }

    setInterval(runSimulation, 2000);

    function renderOvens() {
        const container = document.getElementById('ovens-container');
        if (!container) return;
        container.innerHTML = '';
        state.ovens.forEach(oven => {
            const div = document.createElement('div');
            div.className = `oven-slot pixel-border ${oven.unlocked ? '' : 'locked'}`;
            if (!oven.unlocked) {
                div.innerHTML = `<span>LOCKED</span>`;
            } else if (oven.status === 'idle') {
                div.innerHTML = `
                    <h5>${oven.type.toUpperCase()} OVEN</h5>
                    <div class="cook-btns">
                        <button class="btn small" onclick="startCook(${oven.id}, 'meth')">METH</button>
                        <button class="btn small" onclick="startCook(${oven.id}, 'crack')">CRACK</button>
                        <button class="btn small" onclick="startCook(${oven.id}, 'heroin')">HEROIN</button>
                        <button class="btn small" onclick="startCook(${oven.id}, 'dmt')">DMT</button>
                        <button class="btn small" onclick="startCook(${oven.id}, 'lsd')">LSD</button>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <h5>COOKING ${oven.drug.toUpperCase()}</h5>
                    <div class="progress-bar-container"><div class="progress-bar" style="width:${oven.progress}%"></div></div>
                `;
            }
            container.appendChild(div);
        });
    }

    window.startCook = (ovenId, drug) => {
        const oven = state.ovens.find(o => o.id === ovenId);
        const requirements = {
            meth: { pseudo: 1, acid: 1 },
            crack: { packagedBags: 1, bakingSoda: 1 },
            heroin: { poppySeeds: 2, solvent: 1 }, // Poppy process
            dmt: { chemicals: 2, solvent: 1 },
            lsd: { acid: 2, chemicals: 1 }
        };

        const req = requirements[drug];
        let hasReq = true;
        for (let item in req) {
            if (item === 'packagedBags' && state.packagedBags < req[item]) hasReq = false;
            else if (state[item] < req[item]) hasReq = false;
        }

        if (hasReq) {
            for (let item in req) {
                if (item === 'packagedBags') state.packagedBags -= req[item];
                else state[item] -= req[item];
            }
            oven.status = 'cooking';
            oven.drug = drug;
            oven.progress = 0;
            updateUI();

            const interval = setInterval(() => {
                let speed = (oven.type === 'pro' ? 5 : oven.type === 'industrial' ? 10 : 2);
                oven.progress += speed;
                if (oven.progress >= 100) {
                    clearInterval(interval);
                    state[drug] += (drug === 'heroin' ? 5 : 10);
                    oven.status = 'idle';
                    oven.drug = null;
                    oven.progress = 0;
                    updateUI();
                    triggerScreenShake(300);
                } else {
                    renderOvens();
                }
            }, 1000);
        } else {
            alert("Missing ingredients!");
        }
    };

    window.craftIngredient = (type) => {
        if (state.money >= 50) {
            state.money -= 50;
            state[type]++;
            updateUI();
        } else {
            alert("Not enough money to craft!");
        }
    };

    function renderInventory() {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        grid.innerHTML = '<h3>STASH & ARMORY</h3>';
        
        const sections = [
            { 
                title: 'DRUGS', 
                items: [
                    { name: 'WET BUD', val: Math.floor(state.wetGrams) + 'g' },
                    { name: 'DRY BUD', val: Math.floor(state.dryGrams) + 'g' },
                    { name: 'WEED BAGS', val: state.packagedBags },
                    { name: 'PRE-ROLLS', val: state.preRolls },
                    { name: 'METH', val: Math.floor(state.meth) + 'g' },
                    { name: 'CRACK', val: Math.floor(state.crack) + 'g' },
                    { name: 'HEROIN', val: Math.floor(state.heroin) + 'g' },
                    { name: 'DMT', val: Math.floor(state.dmt) + 'g' },
                    { name: 'LSD', val: state.lsd + ' hits' }
                ]
            },
            {
                title: 'GUNS',
                items: [
                    { name: 'GLOCKS', val: state.glocks },
                    { name: 'MODDED GLOCKS', val: state.moddedGlocks },
                    { name: 'SWITCHES', val: state.switches },
                    { name: 'EXT MAGS', val: state.extMags },
                    { name: 'DRUMS', val: state.drumMags },
                    { name: 'LASERS', val: state.lasers }
                ]
            },
            {
                title: 'SUPPLIES',
                items: [
                    { name: 'WEED SEEDS', val: state.seeds },
                    { name: 'POPPY SEEDS', val: state.poppySeeds },
                    { name: 'PAPERS', val: state.papers },
                    { name: 'PSEUDO', val: state.pseudo },
                    { name: 'ACID', val: state.acid },
                    { name: 'SODA', val: state.bakingSoda },
                    { name: 'CHEM', val: state.chemicals },
                    { name: 'SOLVENT', val: state.solvent }
                ]
            }
        ];

        sections.forEach(s => {
            const h4 = document.createElement('h4');
            h4.textContent = s.title;
            h4.style.color = '#ff00ff';
            grid.appendChild(h4);
            
            s.items.forEach(i => {
                const div = document.createElement('div');
                div.className = 'inv-item pixel-border-small';
                div.innerHTML = `<span>${i.name}</span><span>${i.val}</span>`;
                grid.appendChild(div);
            });
        });

        // Add Armory Button if owned
        if (state.upgrades.hasArmory && state.glocks > 0) {
            const modBtn = document.createElement('button');
            modBtn.className = 'btn large';
            modBtn.textContent = 'MOD GLOCK (1x Switch, 1x Drum, 1x Laser)';
            modBtn.onclick = () => modWeapon();
            grid.appendChild(modBtn);
        }
    }

    window.modWeapon = () => {
        if (state.glocks >= 1 && state.switches >= 1 && state.drumMags >= 1 && state.lasers >= 1) {
            state.glocks--;
            state.switches--;
            state.drumMags--;
            state.lasers--;
            state.moddedGlocks++;
            updateUI();
            renderInventory();
            triggerScreenShake(500);
            alert("GLOCK MODDED: FULL AUTO SWITCH + DRUM + LASER");
        } else {
            alert("Missing parts for modding!");
        }
    };

    window.buyBlackMarket = (item) => {
        const costs = { 
            seeds: 10,
            poppySeeds: 50,
            pseudo: 200, 
            acid: 150, 
            bakingSoda: 50, 
            chemicals: 300,
            solvent: 100,
            glocks: 500,
            switches: 800,
            extMags: 150,
            drumMags: 300,
            lasers: 100
        };
        if (state.money >= costs[item]) {
            state.money -= costs[item];
            state[item]++;
            updateUI();
            triggerScreenShake(100);
        } else {
            alert("Not enough money!");
        }
    };

    function renderDrySlots() {
        const rack = document.getElementById('drying-rack');
        if (!rack) return;
        rack.innerHTML = '';
        state.dryingBuds.forEach((bud, index) => {
            const slot = document.createElement('div');
            slot.className = `dry-slot ${bud === 'locked' ? 'locked' : ''}`;
            slot.dataset.index = index;
            if (bud === 'locked') {
                slot.innerHTML = '<span class="lock-icon">🔒</span>';
            } else if (bud === null) {
                slot.innerHTML = `<button class="btn small" onclick="startDrying(${index})">START DRY</button>`;
            } else {
                if (bud.progress >= 100) {
                    slot.innerHTML = `<button class="btn small" onclick="collectDry(${index})">COLLECT</button>`;
                } else {
                    slot.innerHTML = `<div class="hanging-bud"></div><div class="progress-bar-container"><div class="progress-bar" style="width:${bud.progress}%"></div></div>`;
                }
            }
            rack.appendChild(slot);
        });
    }

    window.changeStrain = (val) => {
        state.currentStrainIndex = parseInt(val);
        console.log("Strain changed to:", state.strains[state.currentStrainIndex].name);
    };

    function renderUpgrades() {
        const listContainer = document.getElementById('app-upgrades');
        if (!listContainer) return;
        
        listContainer.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>Build</h4>
                <div id="upgrade-list"></div>
            </div>
        `;

        const list = document.getElementById('upgrade-list');
        if (!list) return;
        
        // Categorized Upgrades
        const categories = [
            {
                title: 'GROWING',
                items: [
                    { id: 'unlock_pot', name: 'New Pot Slot', cost: (state.upgrades.unlockedPots) * 250, available: state.upgrades.unlockedPots < 6 },
                    { id: 'pot', name: 'Pot Quality', cost: (state.upgrades.potLevel + 1) * 300, level: state.upgrades.potLevel, max: 2 },
                    { id: 'lights', name: 'Pro Lights', cost: 1000, owned: state.upgrades.hasProLights },
                    { id: 'strain', name: 'Next Strain', cost: (state.upgrades.unlockedStrains) * 1500, available: state.upgrades.unlockedStrains < state.strains.length }
                ]
            },
            {
                title: 'KITCHEN',
                items: [
                    { id: 'kitchen', name: 'Unlock Kitchen', cost: 2500, owned: state.upgrades.hasKitchen },
                    { id: 'oven_pro', name: 'Pro Oven', cost: 2000, available: state.upgrades.hasKitchen && !state.ovens[1].unlocked },
                    { id: 'oven_industrial', name: 'Ind. Oven', cost: 5000, available: state.upgrades.hasKitchen && state.ovens[1].unlocked && !state.ovens[2].unlocked }
                ]
            },
            {
                title: 'SYSTEMS',
                items: [
                    { id: 'black_market', name: 'Black Market App', cost: 1500, owned: state.upgrades.hasBlackMarket },
                    { id: 'armory', name: 'Armory (Mod Guns)', cost: 4000, owned: state.upgrades.hasArmory },
                    { id: 'fill_orders', name: 'Unlock Fill Orders', cost: 2000, owned: state.upgrades.hasFillOrders },
                    { id: 'filter', name: 'Carbon Filter', cost: (state.upgrades.filterLevel + 1) * 800, level: state.upgrades.filterLevel, max: 3 },
                    { id: 'lights_app', name: 'RGB Lights App', cost: 500, owned: state.upgrades.hasLightsApp }
                ]
            }
        ];

        categories.forEach(cat => {
            const h5 = document.createElement('h5');
            h5.textContent = cat.title;
            h5.style.color = '#ff00ff';
            h5.style.marginTop = '15px';
            h5.style.fontSize = '0.5rem';
            list.appendChild(h5);

            cat.items.forEach(u => {
                const div = document.createElement('div');
                div.className = 'upgrade-item item-row';
                const isOwned = u.owned || (u.level !== undefined && u.level >= u.max);
                const isAvailable = u.available !== false;
                
                div.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span>${u.name}</span>
                        <span style="font-size:0.35rem; color:#888;">${u.level !== undefined ? `Level ${u.level}` : ''}</span>
                    </div>
                    <button class="btn small" ${isOwned || !isAvailable ? 'disabled' : ''} onclick="buyUpgrade('${u.id}')">
                        ${isOwned ? 'MAX' : (isAvailable ? `$${u.cost}` : 'LOCKED')}
                    </button>
                `;
                list.appendChild(div);
            });
        });
    }

    window.buyUpgrade = (id) => {
        let cost = 0;
        let success = false;

        if (id === 'unlock_pot') {
            cost = state.upgrades.unlockedPots * 250;
            if (state.money >= cost && state.upgrades.unlockedPots < 6) {
                state.pots[state.upgrades.unlockedPots] = null;
                state.upgrades.unlockedPots++;
                success = true;
            }
        } else if (id === 'unlock_dry') {
            cost = state.upgrades.unlockedDryers * 500;
            if (state.money >= cost && state.upgrades.unlockedDryers < 3) {
                state.dryingBuds[state.upgrades.unlockedDryers] = null;
                state.upgrades.unlockedDryers++;
                success = true;
            }
        } else if (id === 'pot') {
            cost = (state.upgrades.potLevel + 1) * 300;
            if (state.money >= cost && state.upgrades.potLevel < 2) {
                state.upgrades.potLevel++;
                success = true;
            }
        } else if (id === 'lights') {
            cost = 1000;
            if (state.money >= cost && !state.upgrades.hasProLights) {
                state.upgrades.hasProLights = true;
                success = true;
            }
        } else if (id === 'kitchen') {
            cost = 2500;
            if (state.money >= cost && !state.upgrades.hasKitchen) {
                state.upgrades.hasKitchen = true;
                success = true;
            }
        } else if (id === 'oven_pro') {
            cost = 2000;
            if (state.money >= cost && !state.ovens[1].unlocked) {
                state.ovens[1].unlocked = true;
                success = true;
            }
        } else if (id === 'oven_industrial') {
            cost = 5000;
            if (state.money >= cost && !state.ovens[2].unlocked) {
                state.ovens[2].unlocked = true;
                success = true;
            }
        } else if (id === 'black_market') {
            cost = 1500;
            if (state.money >= cost && !state.upgrades.hasBlackMarket) {
                state.upgrades.hasBlackMarket = true;
                success = true;
            }
        } else if (id === 'armory') {
            cost = 4000;
            if (state.money >= cost && !state.upgrades.hasArmory) {
                state.upgrades.hasArmory = true;
                success = true;
            }
        } else if (id === 'fill_orders') {
            cost = 2000;
            if (state.money >= cost && !state.upgrades.hasFillOrders) {
                state.upgrades.hasFillOrders = true;
                success = true;
            }
        } else if (id === 'filter') {
            cost = (state.upgrades.filterLevel + 1) * 800;
            if (state.money >= cost && state.upgrades.filterLevel < 3) {
                state.upgrades.filterLevel++;
                success = true;
            }
        } else if (id === 'lights_app') {
            cost = 500;
            if (state.money >= cost && !state.upgrades.hasLightsApp) {
                state.upgrades.hasLightsApp = true;
                success = true;
            }
        } else if (id === 'strain') {
            cost = state.upgrades.unlockedStrains * 1500;
            if (state.money >= cost && state.upgrades.unlockedStrains < state.strains.length) {
                state.upgrades.unlockedStrains++;
                success = true;
            }
        }

        if (success) {
            state.money -= cost;
            addBankEntry(`Upgrade ${id.toUpperCase()} purchased for $${cost}`, 'negative');
            updateUI();
            triggerScreenShake(200);
        } else {
            alert("Can't afford or already maxed!");
        }
    };

    // Tool Selection logic
    function selectTool(tool) {
        state.activeTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        console.log("Selected tool:", tool);
    }

    // Initialize Pot Slots
    function renderPotSlots() {
        const field = document.getElementById('farm-field');
        if (!field) return;
        
        // Save current plants to re-instantiate them if they exist
        const currentPlants = field.querySelectorAll('.plant-container');
        
        field.innerHTML = '';
        state.pots.forEach((pot, index) => {
            const slot = document.createElement('div');
            slot.className = `pot-slot pixel-border ${pot === 'locked' ? 'locked' : ''}`;
            slot.dataset.index = index;
            
            if (pot === 'locked') {
                slot.innerHTML = '<span class="lock-icon">🔒</span>';
            } else {
                slot.onclick = (e) => {
                    if (state.activeTool === 'plant' && !state.pots[index]) {
                        if (state.seeds > 0) {
                            state.seeds--;
                            state.pots[index] = new Plant(index);
                            updateUI();
                        } else {
                            alert("No seeds!");
                        }
                    }
                };
            }
            field.appendChild(slot);
            
            // If there's already a plant object in state for this index, re-render it
            if (state.pots[index] instanceof Plant) {
                state.pots[index].render();
            }
        });
    }

    function triggerScreenShake(d) {
        document.body.classList.add('shake-screen');
        setTimeout(() => document.body.classList.remove('shake-screen'), d);
    }

    // Initialize Game
    window.startGame = () => {
        console.log("Game Starting...");
        const loading = document.getElementById('loading-screen');
        const ui = document.getElementById('game-ui');
        
        if (loading) loading.classList.add('hidden');
        if (ui) ui.classList.remove('hidden');
        
        if (bgMusic) {
            bgMusic.play().catch(e => console.log("Music blocked: ", e));
        }
        
        startBeatSync();
        setRoomLight('purple');
        updateUI();
        zoomStation('grow');
    };

    // Beat Sync Logic
    const bpm = 140;
    const beatInterval = (60 / bpm) * 1000;
    function startBeatSync() {
        setInterval(() => {
            if (!gameUI.classList.contains('hidden')) {
                document.body.classList.add('beat-shake');
                setTimeout(() => document.body.classList.remove('beat-shake'), 100);
            }
        }, beatInterval);
    }

    // Show play button after loading animation
    setTimeout(() => {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = 'PLUG CONNECTED';
        const actions = document.getElementById('loading-actions');
        if (actions) actions.classList.remove('hidden');
    }, 3000);


    // DRYING LOGIC
    window.startDrying = (slotIndex) => {
        if (state.wetGrams >= 50 && state.dryingBuds[slotIndex] === null) {
            state.wetGrams -= 50;
            state.dryingBuds[slotIndex] = { progress: 0 };
            updateUI();
            
            const interval = setInterval(() => {
                if (!state.dryingBuds[slotIndex] || state.dryingBuds[slotIndex] === 'locked') {
                    clearInterval(interval);
                    return;
                }
                
                state.dryingBuds[slotIndex].progress += 5;
                if (state.dryingBuds[slotIndex].progress >= 100) {
                    state.dryingBuds[slotIndex].progress = 100;
                    state.dryGrams += 20;
                    updateUI();
                    clearInterval(interval);
                } else {
                    renderDrySlots();
                }
            }, 1000);
        }
    };

    window.collectDry = (index) => {
        state.dryingBuds[index] = null;
        updateUI();
    };

    class PhysicsObject {
        constructor(element, x, y, weight, type) {
            this.element = element;
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.weight = weight;
            this.type = type;
            this.isDragging = false;
            this.width = 40;
            this.height = 50;
            
            this.init();
        }

        init() {
            this.element.style.position = 'absolute';
            this.element.style.left = '0';
            this.element.style.top = '0';
            this.updateElement();

            this.element.addEventListener('mousedown', (e) => this.startDrag(e));
        }

        startDrag(e) {
            this.isDragging = true;
            this.vx = 0;
            this.vy = 0;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            
            const onMouseMove = (moveEvent) => {
                if (!this.isDragging) return;
                const dx = moveEvent.clientX - this.lastX;
                const dy = moveEvent.clientY - this.lastY;
                
                this.x += dx;
                this.y += dy;
                this.vx = dx * 0.8;
                this.vy = dy * 0.8;
                
                this.lastX = moveEvent.clientX;
                this.lastY = moveEvent.clientY;
                this.updateElement();
            };

            const onMouseUp = () => {
                this.isDragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                
                // Check if dropped on scale
                const scaleEl = document.getElementById('digital-scale');
                if (!scaleEl) return;

                const scaleRect = scaleEl.getBoundingClientRect();
                const leafRect = this.element.getBoundingClientRect();
                
                if (leafRect.left < scaleRect.right && 
                    leafRect.right > scaleRect.left &&
                    leafRect.top < scaleRect.bottom &&
                    leafRect.bottom > scaleRect.top) {
                    
                    // Add to scale
                    if (this.type === 'wet') state.wetGrams -= this.weight;
                    else state.dryGrams -= this.weight;
                    
                    targetScaleWeight += this.weight;
                    animateScale();
                    
                    // Remove object
                    this.element.remove();
                    const idx = physicsObjects.indexOf(this);
                    if (idx > -1) physicsObjects.splice(idx, 1);
                    renderBins();
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }

        update() {
            if (this.isDragging) return;

            this.vy += gravity;
            this.vx *= friction;
            this.vy *= friction;

            this.x += this.vx;
            this.y += this.vy;

            // Table boundaries (hardcoded for now, relative to metal-table)
            const table = document.querySelector('.metal-table');
            if (!table) return;

            const rect = table.getBoundingClientRect();
            
            // Bounce floor
            if (this.y > rect.height - this.height) {
                this.y = rect.height - this.height;
                this.vy *= -bounce;
                if (Math.abs(this.vy) < 1) this.vy = 0;
            }

            // Walls
            if (this.x < 0) {
                this.x = 0;
                this.vx *= -bounce;
            } else if (this.x > rect.width - this.width) {
                this.x = rect.width - this.width;
                this.vx *= -bounce;
            }

            this.updateElement();
        }

        updateElement() {
            this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }
    }

    // PACKAGING & BIN SYSTEM
    function renderBins() {
        if (!metalTable) return;
        
        // Count how many leaves we have vs how many are in state
        const currentWetOnTable = physicsObjects.filter(o => o.type === 'wet').length;
        const currentDryOnTable = physicsObjects.filter(o => o.type === 'dry').length;
        
        const wetTarget = Math.floor(state.wetGrams / 10);
        const dryTarget = Math.floor(state.dryGrams / 3.5);

        // Add missing wet leaves
        for(let i = currentWetOnTable; i < Math.min(wetTarget, 8); i++) {
            createPhysicsLeaf(10, 'wet');
        }

        // Add missing dry leaves
        for(let i = currentDryOnTable; i < Math.min(dryTarget, 8); i++) {
            createPhysicsLeaf(3.5, 'dry');
        }
    }

    function createPhysicsLeaf(weight, type) {
        const div = document.createElement('div');
        div.className = 'pixel-leaf';
        div.dataset.weight = weight;
        div.dataset.type = type;
        div.title = `${weight}g`;
        
        // Append to table
        metalTable.appendChild(div);

        // Spawn position
        const rect = metalTable.getBoundingClientRect();
        const x = type === 'wet' ? 100 : rect.width - 200;
        const y = 100;
        
        const obj = new PhysicsObject(div, x, y, weight, type);
        physicsObjects.push(obj);

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openCutUI(weight, div, obj);
        });

        return div;
    }

    function updatePhysics() {
        physicsObjects.forEach(obj => obj.update());
        requestAnimationFrame(updatePhysics);
    }
    updatePhysics();

    // Scale Logic
    if (digitalScale) {
        digitalScale.addEventListener('dragover', (e) => e.preventDefault());
        digitalScale.addEventListener('drop', (e) => {
            const weight = parseFloat(e.dataTransfer.getData('weight'));
            const type = e.dataTransfer.getData('type');
            
            if (type === 'wet') state.wetGrams -= weight;
            else state.dryGrams -= weight;

            targetScaleWeight += weight;
            animateScale();
            renderBins();
        });
    }

    function animateScale() {
        if (!scaleDisplay) return;
        const diff = targetScaleWeight - currentScaleWeight;
        if (Math.abs(diff) < 0.01) {
            currentScaleWeight = targetScaleWeight;
            scaleDisplay.textContent = currentScaleWeight.toFixed(2);
            return;
        }

        currentScaleWeight += diff * 0.1;
        scaleDisplay.textContent = currentScaleWeight.toFixed(2);
        requestAnimationFrame(animateScale);
    }

    // Leaf Cutting UI
    window.openCutUI = (weight, element, physicsObj) => {
        if (cutUI) {
            leafBeingCut = { weight, element, physicsObj };
            cutUI.classList.remove('hidden');
        }
    };

    window.closeCutUI = () => {
        if (cutUI) {
            cutUI.classList.add('hidden');
            leafBeingCut = null;
        }
    };

    window.confirmCut = (targetWeight) => {
        if (!leafBeingCut) return;
        const remainder = leafBeingCut.weight - targetWeight;
        
        if (remainder < 0) {
            alert("Leaf too small to cut!");
            return;
        }

        // Apply changes to state
        const type = leafBeingCut.physicsObj.type;
        if (type === 'wet') {
            state.wetGrams -= leafBeingCut.weight;
            state.wetGrams += remainder; // Scraps go back to state
        } else {
            state.dryGrams -= leafBeingCut.weight;
            state.dryGrams += remainder;
        }

        // The piece we cut goes to the scale
        targetScaleWeight += targetWeight;
        
        // Remove the original physics object
        leafBeingCut.element.remove();
        const idx = physicsObjects.indexOf(leafBeingCut.physicsObj);
        if (idx > -1) physicsObjects.splice(idx, 1);

        closeCutUI();
        animateScale();
        renderBins(); // This will respawn the remainder as a new leaf if needed
        triggerScreenShake(100);
    };

    window.clearScale = () => {
        // Return everything to the correct bins based on what we dropped (mostly dry)
        state.dryGrams += targetScaleWeight;
        targetScaleWeight = 0;
        animateScale();
        renderBins();
    };

    window.packBag = () => {
        if (targetScaleWeight >= 3.5) {
            targetScaleWeight -= 3.5;
            state.packagedBags += 1;
            animateScale();
            renderBins();
            triggerScreenShake(300);
            updateUI();
        } else {
            alert("Not enough on the scale!");
        }
    };

    function generateOrder() {
        if (gameUI.classList.contains('hidden')) return;
        
        // Progression check for Fill Orders
        const canDoFill = state.upgrades.hasFillOrders;
        const isFillOrder = canDoFill && Math.random() > 0.85; // Fill orders are rare
        
        const pool = ['weed', 'preRoll', 'meth', 'crack', 'heroin', 'dmt', 'lsd'];
        if (state.glocks > 0) pool.push('glock');
        if (state.moddedGlocks > 0) pool.push('moddedGlock');
        
        if (isFillOrder) {
            // Fill Order: Massive, Rare, Manual, High Profit (Can ping even if no stock, as goal is to MAKE it)
            const type = pool[Math.floor(Math.random() * pool.length)];
            let amount, price, label;
            if (type === 'weed') {
                const sIdx = Math.floor(Math.random() * state.upgrades.unlockedStrains);
                const strain = state.strains[sIdx];
                amount = Math.floor(Math.random() * 15) + 15; // 15-30 bags
                price = amount * strain.price * 2.5; // Massive profit multiplier
                label = `${amount} bags ${strain.name}`;
            } else if (type === 'preRoll') {
                amount = Math.floor(Math.random() * 20) + 20; // 20-40 pre-rolls
                price = amount * 40; // High value for bulk pre-rolls
                label = `${amount}x Pre-Rolls`;
            } else if (type === 'glock' || type === 'moddedGlock') {
                amount = Math.floor(Math.random() * 2) + 2; // 2-3 guns
                price = (type === 'glock' ? 1500 : 4500) * amount;
                label = `${amount}x ${type.toUpperCase()}`;
            } else {
                amount = Math.floor(Math.random() * 30) + 30; // 30-60g
                const prices = { meth: 200, crack: 250, heroin: 400, dmt: 500, lsd: 100 };
                price = amount * (prices[type] || 150) * 1.8;
                label = `${amount}g ${type.toUpperCase()}`;
            }
            state.orders.push({ id: Date.now(), isFill: true, type, amount, price, label });
        } else {
            // Quick Order: Only ping if we actually HAVE stock
            const stockPool = [];
            if (state.packagedBags > 0) stockPool.push('weed');
            if (state.preRolls > 0) stockPool.push('preRoll');
            if (state.meth > 0) stockPool.push('meth');
            if (state.crack > 0) stockPool.push('crack');
            if (state.heroin > 0) stockPool.push('heroin');
            if (state.dmt > 0) stockPool.push('dmt');
            if (state.lsd > 0) stockPool.push('lsd');
            if (state.glocks > 0) stockPool.push('glock');
            if (state.moddedGlocks > 0) stockPool.push('moddedGlock');

            if (stockPool.length === 0) return; // No stock, no quick flips

            const type = stockPool[Math.floor(Math.random() * stockPool.length)];
            let amount, price, label;
            if (type === 'weed') {
                const sIdx = Math.floor(Math.random() * state.upgrades.unlockedStrains);
                const strain = state.strains[sIdx];
                amount = Math.min(state.packagedBags, Math.floor(Math.random() * 3) + 1);
                price = amount * strain.price * 0.9;
                label = `${amount} bags ${strain.name}`;
            } else if (type === 'preRoll') {
                amount = Math.min(state.preRolls, Math.floor(Math.random() * 5) + 1);
                price = amount * 25;
                label = `${amount}x Pre-Rolls`;
            } else if (type === 'glock' || type === 'moddedGlock') {
                amount = 1;
                price = type === 'glock' ? 800 : 2800;
                label = `1x ${type.toUpperCase()}`;
            } else {
                const currentStock = state[type] || 0;
                amount = Math.min(currentStock, Math.floor(Math.random() * 5) + 5);
                const prices = { meth: 80, crack: 120, heroin: 180, dmt: 250, lsd: 30 };
                price = amount * (prices[type] || 80);
                label = `${amount}g ${type.toUpperCase()}`;
            }
            if (amount > 0) {
                state.orders.push({ id: Date.now(), isFill: false, type, amount, price, label });
            }
        }
        
        renderOrders();
        
        if (phoneOverlay.classList.contains('show')) {
            triggerScreenShake(200);
        }
    }

    function renderOrders() {
        const container = document.getElementById('app-orders');
        if (!container) return;
        
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">←</button>
            <h4>Pings</h4>
            <div id="orders-list" class="detailed-app-list"></div>
        `;

        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        const badge = document.getElementById('order-count');
        if (badge) {
            badge.textContent = state.orders.length;
            badge.classList.toggle('show', state.orders.length > 0);
        }

        state.orders.forEach(o => {
            const div = document.createElement('div');
            div.className = `order-item item-row ${o.isFill ? 'fill-order' : 'quick-order'}`;
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                    <div class="order-tag" style="width:fit-content;">${o.isFill ? 'FILL' : 'QUICK'}</div>
                    <span style="font-size:0.4rem;">${o.label}</span>
                    <span class="price">$${Math.floor(o.price)}</span>
                </div>
                <button class="btn small" onclick="fillOrder(${o.id})">TRAP</button>
            `;
            ordersList.appendChild(div);
        });
    }

    window.fillOrder = (id) => {
        const oIdx = state.orders.findIndex(order => order.id === id);
        const o = state.orders[oIdx];
        
        let stockVal = 0;
        if (o.type === 'weed') stockVal = state.packagedBags;
        else if (o.type === 'preRoll') stockVal = state.preRolls;
        else if (o.type === 'glock') stockVal = state.glocks;
        else if (o.type === 'moddedGlock') stockVal = state.moddedGlocks;
        else stockVal = state[o.type] || 0;

        if (stockVal >= o.amount) {
            if (o.type === 'weed') state.packagedBags -= o.amount;
            else if (o.type === 'preRoll') state.preRolls -= o.amount;
            else if (o.type === 'glock') state.glocks -= o.amount;
            else if (o.type === 'moddedGlock') state.moddedGlocks -= o.amount;
            else state[o.type] -= o.amount;

            state.money += o.price;
            state.reputation += o.isFill ? 50 : 10;
            state.orders.splice(oIdx, 1);
            renderOrders();
            updateUI();
            triggerScreenShake(o.isFill ? 800 : 300);
        } else {
            alert("Not enough stock!");
        }
    };

    // App Switching
    window.showApp = (appName) => {
        document.querySelectorAll('.phone-app').forEach(app => app.classList.add('hidden'));
        const appList = document.getElementById('phone-app-list');
        if (appList) appList.classList.add('hidden');
        
        if (appName === 'home') {
            if (appList) appList.classList.remove('hidden');
        } else {
            const app = document.getElementById(`app-${appName}`);
            if (app) {
                app.classList.remove('hidden');
                // Scroll to top of app
                app.scrollTop = 0;
            }
        }
        
        if (appName === 'stats') renderStats();
        if (appName === 'bank') renderBank();
        if (appName === 'upgrades') renderUpgrades();
        if (appName === 'orders') renderOrders();
        if (appName === 'store') renderStore();
        if (appName === 'blackmarket') renderBlackMarket();
        if (appName === 'recipes') renderRecipes();
    };

    function renderRecipes() {
        const container = document.getElementById('app-recipes');
        if (!container) return;
        
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>Recipe Book</h4>
                
                <div class="app-section-title">Weed Products</div>
                <div class="detailed-app-list">
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Pre-Roll</span>
                            <span style="font-size:0.35rem; color:#888;">1g Dry Bud + 1 Paper</span>
                        </div>
                    </div>
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Weed Bag</span>
                            <span style="font-size:0.35rem; color:#888;">3.5g Dry Bud (Scale)</span>
                        </div>
                    </div>
                </div>

                <div class="app-section-title">Kitchen (Drugs)</div>
                <div class="detailed-app-list">
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Meth</span>
                            <span style="font-size:0.35rem; color:#888;">1 Pseudo + 1 Acid</span>
                        </div>
                    </div>
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Crack</span>
                            <span style="font-size:0.35rem; color:#888;">1 Weed Bag + 1 Soda</span>
                        </div>
                    </div>
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Heroin</span>
                            <span style="font-size:0.35rem; color:#888;">2 Poppy Seeds + 1 Solvent</span>
                        </div>
                    </div>
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>DMT</span>
                            <span style="font-size:0.35rem; color:#888;">2 Chemicals + 1 Solvent</span>
                        </div>
                    </div>
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>LSD</span>
                            <span style="font-size:0.35rem; color:#888;">2 Acid + 1 Chemicals</span>
                        </div>
                    </div>
                </div>

                <div class="app-section-title">Armory (Guns)</div>
                <div class="detailed-app-list">
                    <div class="item-row">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span>Modded Glock</span>
                            <span style="font-size:0.35rem; color:#888;">1 Glock + 1 Switch + 1 Drum + 1 Laser</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBank() {
        const container = document.getElementById('app-bank');
        if (!container) return;
        
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>iBank</h4>
                <div class="bank-balance-card">
                    <span class="app-section-title">Available Balance</span>
                    <h2>$${Math.floor(state.money)}</h2>
                </div>
                <div class="app-section-title">Recent Activity</div>
                <div id="bank-history" class="detailed-app-list"></div>
            </div>
        `;

        const list = document.getElementById('bank-history');
        if (!list) return;
        state.bankHistory.forEach(e => {
            const div = document.createElement('div');
            div.className = `item-row ${e.type}`;
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.35rem; color:#888;">${e.time}</span>
                    <span>${e.text}</span>
                </div>
            `;
            list.appendChild(div);
        });
    }

    function renderStore() {
        const container = document.getElementById('app-store');
        if (!container) return;
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>App Store</h4>
                <div class="app-section-title">Supplies</div>
                <div class="detailed-app-list">
                    <div class="item-row">
                        <span>Weed Seeds</span>
                        <button class="btn small" onclick="buyItem('seeds', 10)">$10</button>
                    </div>
                    <div class="item-row">
                        <span>Papers (5x)</span>
                        <button class="btn small" onclick="buyItem('papers', 20)">$20</button>
                    </div>
                    <div class="item-row">
                        <span>Nutrients</span>
                        <button class="btn small" onclick="buyItem('nutrients', 50)">$50</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBlackMarket() {
        const container = document.getElementById('app-blackmarket');
        if (!container) return;
        container.innerHTML = `
            <button class="phone-back-btn" onclick="homeClick()">← Back</button>
            <div class="app-content-wrapper">
                <h4>Black Market</h4>
                <div class="app-section-title">Precursors</div>
                <div class="detailed-app-list">
                    <div class="item-row"><span>Poppy Seeds</span><button class="btn small" onclick="buyBlackMarket('poppySeeds')">$50</button></div>
                    <div class="item-row"><span>Pseudo</span><button class="btn small" onclick="buyBlackMarket('pseudo')">$200</button></div>
                    <div class="item-row"><span>Acid</span><button class="btn small" onclick="buyBlackMarket('acid')">$150</button></div>
                    <div class="item-row"><span>Baking Soda</span><button class="btn small" onclick="buyBlackMarket('bakingSoda')">$50</button></div>
                    <div class="item-row"><span>Chemicals</span><button class="btn small" onclick="buyBlackMarket('chemicals')">$300</button></div>
                    <div class="item-row"><span>Solvent</span><button class="btn small" onclick="buyBlackMarket('solvent')">$100</button></div>
                </div>
                <div class="app-section-title">Hardware</div>
                <div class="detailed-app-list">
                    <div class="item-row"><span>Glock</span><button class="btn small" onclick="buyBlackMarket('glocks')">$500</button></div>
                    <div class="item-row"><span>Switch</span><button class="btn small" onclick="buyBlackMarket('switches')">$800</button></div>
                    <div class="item-row"><span>Ext. Mag</span><button class="btn small" onclick="buyBlackMarket('extMags')">$150</button></div>
                    <div class="item-row"><span>Drum Mag</span><button class="btn small" onclick="buyBlackMarket('drumMags')">$300</button></div>
                    <div class="item-row"><span>Red Laser</span><button class="btn small" onclick="buyBlackMarket('lasers')">$100</button></div>
                </div>
            </div>
        `;
    }

    window.homeClick = () => showApp('home');

    window.buyItem = (item, cost) => {
        if (state.money >= cost) {
            state.money -= cost;
            if (item === 'nutrients') {
                state.pots.forEach(p => { if(p) p.nutrients = 100; p?.updateBars(); });
            } else {
                state[item] += 5;
            }
            addBankEntry(`Purchased ${item.toUpperCase()}`, 'negative');
            updateUI();
        } else {
            alert("Not enough cash!");
        }
    };

    function addBankEntry(text, type) {
        state.bankHistory.unshift({ text, type, time: new Date().toLocaleTimeString() });
        if (state.bankHistory.length > 10) state.bankHistory.pop();
        renderBank();
    }

    function updateCrypto() {
        for (let coin in state.crypto) {
            const change = (Math.random() - 0.48) * (state.crypto[coin].price * 0.05); // Bias slightly up
            state.crypto[coin].price = Math.max(0.01, state.crypto[coin].price + change);
            state.crypto[coin].history.push(state.crypto[coin].price);
            if (state.crypto[coin].history.length > 20) state.crypto[coin].history.shift();
        }
        
        const app = document.getElementById('app-crypto');
        if (app && !app.classList.contains('hidden')) renderCrypto();
    }

    function renderCrypto() {
        const container = document.getElementById('app-crypto');
        if (!container) return;
        
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>Crypto.com</h4>
                <div class="detailed-app-list">
                    ${Object.keys(state.crypto).map(key => {
                        const coin = state.crypto[key];
                        const trend = coin.history[coin.history.length-1] >= coin.history[coin.history.length-2] ? '📈' : '📉';
                        return `
                            <div class="crypto-card">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>${coin.name} ${trend}</span>
                                    <span class="price">$${coin.price > 100 ? Math.floor(coin.price) : coin.price.toFixed(2)}</span>
                                </div>
                                <div class="crypto-graph">
                                    ${coin.history.map(p => `<div class="graph-bar" style="height:${(p/Math.max(...coin.history))*30}px"></div>`).join('')}
                                </div>
                                <div style="font-size:0.35rem; color:#888; margin:5px 0;">Owned: ${coin.owned}</div>
                                <div class="crypto-btns" style="display:flex; gap:10px;">
                                    <button class="btn small" onclick="tradeCrypto('${key}', 'buy')">BUY</button>
                                    <button class="btn small" onclick="tradeCrypto('${key}', 'sell')">SELL</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    window.tradeCrypto = (coinKey, action) => {
        const coin = state.crypto[coinKey];
        if (action === 'buy') {
            if (state.money >= coin.price) {
                state.money -= coin.price;
                coin.owned++;
                addBankEntry(`Bought 1 ${coin.name} for $${coin.price.toFixed(2)}`, 'negative');
            }
        } else {
            if (coin.owned > 0) {
                state.money += coin.price;
                coin.owned--;
                addBankEntry(`Sold 1 ${coin.name} for $${coin.price.toFixed(2)}`, 'positive');
            }
        }
        renderCrypto();
        updateUI();
    };

    window.saveGame = () => {
        localStorage.setItem('trapStarSave', JSON.stringify(state));
        alert("Game Saved!");
    };

    // CHEAT SCRIPT
    window.addMoney = (amount) => {
        state.money += amount;
        addBankEntry(`CHEAT: Added $${amount}`, 'positive');
        updateUI();
        console.log(`Added $${amount}. Current balance: $${state.money}`);
    };

    window.unlockAll = () => {
        state.upgrades.unlockedPots = 6;
        state.pots = [null, null, null, null, null, null];
        state.upgrades.hasKitchen = true;
        state.upgrades.hasBlackMarket = true;
        state.upgrades.hasArmory = true;
        state.upgrades.hasFillOrders = true;
        state.ovens.forEach(o => o.unlocked = true);
        state.upgrades.unlockedStrains = 5;
        updateUI();
        console.log("Everything unlocked!");
    };

    window.exportSave = () => {
        const data = btoa(JSON.stringify(state));
        prompt("Copy this save code:", data);
    };

    // Initialize Tools
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTool = btn.dataset.tool;
            console.log("Tool switched to:", state.activeTool);
        });
    });

    function renderStats() {
        const container = document.getElementById('app-stats');
        if (!container) return;
        
        container.innerHTML = `
            <button class="phone-back-btn" onclick="showApp('home')">← Back</button>
            <div class="app-content-wrapper">
                <h4>Empire Stats</h4>
                <div class="detailed-app-list">
                    <div class="stat-row item-row">
                        <span>Reputation</span>
                        <span class="price">${state.reputation}</span>
                    </div>
                    <div class="stat-row item-row">
                        <span>Modded Guns</span>
                        <span class="price">${state.moddedGlocks}</span>
                    </div>
                    <div class="stat-row item-row">
                        <span>Active Orders</span>
                        <span class="price">${state.orders.length}</span>
                    </div>
                    <div class="stat-row item-row">
                        <span>Current Heat</span>
                        <span class="price" style="color:${state.heat > 50 ? 'red' : 'white'}">${Math.floor(state.heat)}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Initial Loops
    setInterval(generateOrder, 15000);
    setInterval(updateCrypto, 5000);
    
    // Initial UI setup
    updateUI();
});
