import React, {Fragment} from 'react';
import './Synth.css';
class Synth extends React.Component {
  constructor(props) {
    super(props);
    const defaultSynthSettings = {
      wave:'sine',
      id:0,
      gain0:100,
      masterVolume:800,
      tremoloTime:100,
      tremoloGain:0,
      chorusTime:1,
      chorusGain:0,
      octave:0,
      appWidth:null
    }
    this.state = {
      wave: 'sawtooth',
      hertz: 440,
      focusedBox:0,
      noteLength:0,
      audioCtx:null,
      playTouchKeyboard:false,
      stateBoxes:[defaultSynthSettings],
      scope:true,
      scopeColor:'#333333',
      scopeBackground:'#ffffff',
      scopeColorType:'color',
      scopeScale:1,
      windowWidth:window.innerWidth,
      windowHeight:window.innerHeight,
      nodes:{},
      masterGain:null,
      show:null,
      focusedSetting:null,
      reverb:false,
      convolver:null,
      buffers:[],
      colorScheme:'classic',
      analyzeTimeout:null,
      lfoTimeout:null
    }
    this.playOrgan = this.playOrgan.bind(this);
    this.setTouchKeyboard = this.setTouchKeyboard.bind(this);
    this.stopTouch = this.stopTouch.bind(this);
    this.resizeApp = this.resizeApp.bind(this);
    this.inputChange = this.inputChange.bind(this);
    this.changeSetting = this.changeSetting.bind(this);
    this.listeners = this.listeners.bind(this);
    this.stopAllNotes = this.stopAllNotes.bind(this);
    this.stopNote = this.stopNote.bind(this);
    this.stringToPitch = this.stringToPitch.bind(this);
    this.keyToPitch = this.keyToPitch.bind(this);
    this.midiToPitch = this.midiToPitch.bind(this);
    this.analyze = this.analyze.bind(this);
    this.touchOrgan = this.touchOrgan.bind(this);
    this.reverbSwitch = this.reverbSwitch.bind(this);
    this.changeColors = this.changeColors.bind(this);
    this.refreshContext = this.refreshContext.bind(this);
    this.loadReverb = this.loadReverb.bind(this);
    this.persistSession = this.persistSession.bind(this);
    this.restoreSession = this.restoreSession.bind(this);
  }
  persistSession() {
    sessionStorage.setItem('synth-state',JSON.stringify(this.state));
  }
  restoreSession() {
    const session = JSON.parse(window.sessionStorage.getItem('synth-state'));
    if(session){
      session.focusedSetting = null;
      session.nodes = {};
     this.setState(session,()=>{
        this.refreshContext(()=>{
          this.loadReverb();
          this.listeners();
          this.analyze();
          if(this.state.lfo){
            this.setState({lfo:null},()=>{
              this.startLfo();
            });
          }
        });
      });
    }
  }
  changeColors(scheme) {
    this.setState({colorScheme:scheme},()=>{
      if(this.state.analyzeTimeout&&this.state.colorScheme!=='shuffle'){
        clearInterval(this.state.analyzeTimeout);
        this.setState({analyzeTimeout:null});
      }
      if(this.state.colorScheme==='shuffle'&&!this.state.analyzeTimeout){
        const analyzeTimer = setInterval(()=>{
          this.setState({randomColor1:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),randomColor2:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)},()=>{this.analyze()});
        },1500);
        this.setState({analyzeTimeout:analyzeTimer,randomColor1:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),randomColor2:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)},()=>{
          this.analyze()
        });
      } else if(this.state.colorScheme==='random') {
        this.setState({randomColor1:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),randomColor2:'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)},()=>{this.analyze();});
      } else if(this.state.colorScheme!=='shuffle'){this.analyze();}
      this.persistSession();
    });
  }
  reverbSwitch(){
    const reverb = !this.state.reverb;
    this.setState({reverb:reverb},()=>{
      this.connectReverb();
    })
  }
  inputChange(e) {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const state = this.state;
    state[name] = value;
    this.setState(state);
  }
  closeSettingBox(e) {
      this.setState({focusedSetting:null});
  }
  showSetting(setting) {
    if(this.state.focusedSetting===setting){
      this.setState({focusedSetting:null});      
    } else {
      this.setState({focusedSetting:setting});
    }
  }
  changeSetting(box, e) {
    const name = e.target.name;
    const value = e.target.value;
    const stateBoxes = this.state.stateBoxes;
    const stateBox = stateBoxes[box.id];
    stateBox[name] = value;
    this.setState({stateBoxes:stateBoxes},this.persistSession());
  }
  touchOrgan(note, e) {
    if(this.state.playTouchKeyboard){
      this.playOrgan(note);
    }
  }
  setTouchKeyboard(bool) {
    this.setState({playTouchKeyboard:bool});
  }
  stringToPitch(str) {
    const strToNum = {'c-2':-21,'c#-2':-21,'c#-1':-20,'d-1':-19,'d#-1':-18,'e-1':-17,'f-1':-16,'f#-1':-15,'g-1':-14,'g#-1':-13,'a-1':-12,'a#-1':-11,'b-1':-10,'c':-9,'c#':-8,'d':-7,'d#':-6,'e':-5,'f':-4,'f#':-3,'g':-2,'g#':-1,'a':0,'a#':1,'b':2,'c1':3,'c#1':4,'d1':5,'d#1':6,'e1':7,'f1':8,'f#1':9,'g1':10,'g#1':11,'a1':12,'a#1':13,'b1':14,'c2':15,'c#2':16,'d2':17,'d#2':18,'e2':19,'f2':20,'f#2':21,'g2':22,'g#2':23,'a2':24,'a#2':25,'b2':26,'c3':27,};
    if(!strToNum[str]&&strToNum[str]!==0){
      return null;
    } else {
      return strToNum[str];
    }
  }
  keyToPitch(key) {
    const keyToPitch = {78:0,192:0,74:1,77:2,81:2,188:3,87:3,76:4,51:4,190:5,69:5,59:6,52:6,16:-11,65:-10,90:-9,83:-8,88:-7,68:-6,67:-5,86:-4,71:-3,66:-2,72:-1,82:7,84:8,54:9,89:10,55:11,85:12,56:13,73:14,79:15,48:16,80:17,173:18,219:19};
    if(!keyToPitch[key]&&keyToPitch[key]!==0){
      return null;
    } else {
      return keyToPitch[key];
    }
  }
  midiToPitch(key) {
    console.log(key)
    const midiToPitch = {
      36:'c-2',
      37:'c#-1',
      38:'d-1',
      39:'d#-1',
      40:'e-1',
      41:'f-1',
      42:'f#-1',
      43:'g-1',
      44:'g#-1',
      45:'a-1',
      46:'a#-1',
      47:'b-1',
      48:'c',
      49:'c#',
      50:'d',
      51:'d#',
      52:'e',
      53:'f',
      54:'f#',
      55:'g',
      56:'g#',
      57:'a',
      58:'a#',
      59:'b',
      60:'c1',
      61:'c#1',
      62:'d1',
      63:'d#1',
      64:'e1',
      65:'f1',
      66:'f#1',
      67:'g1',
      68:'g#1',
      69:'a1',
      70:'a#1',
      71:'b1',
      72:'c2',
    }
    return !midiToPitch[key]?null:this.stringToPitch(midiToPitch[key]);
  }
  playOrgan(pitch) {
    if(isNaN(pitch)){pitch = this.stringToPitch(pitch);}
    let nodes = this.state.nodes;
    //Stops from making continuous oscillators on keyboard down, then Checks if the pitch is one of the assigned keys, but allows 0 which is throwing as null for some reason
    if(nodes[pitch]){return;}
    if(!pitch&&pitch!==0){return;}
    const settingsBox = this.state.stateBoxes[this.state.focusedBox];
    const octave = settingsBox.octave;
    const audioCtx = this.state.audioCtx;
    const effects = audioCtx.createGain();
    effects.gain.value = !settingsBox.masterVolume?0:settingsBox.masterVolume/1000;

    for(let i = 0;i<1;i++){
      const osc = audioCtx.createOscillator();
      osc.type = settingsBox.wave;
      const freq = this.state.hertz*Math.pow(Math.pow(2, (1/12)), (pitch)+((octave+i)*12));
      osc.frequency.value = freq;
      const oscGain = audioCtx.createGain();            
      oscGain.gain.value = !settingsBox['gain'+i]?0:settingsBox['gain'+i]/100;
      osc.connect(oscGain);
      osc.connect(effects);
      nodes[pitch] = [];
      nodes[pitch].push(osc);
      if(settingsBox.chorusGain>0){
        const chorus0 = audioCtx.createOscillator();
        chorus0.type = settingsBox.wave;
        chorus0.frequency.value = freq+parseInt(settingsBox.chorusTime);
        const chorus0Gain = audioCtx.createGain();            
        chorus0Gain.gain.value = !settingsBox['gain'+i]?0:(settingsBox['gain'+i])/100;
        chorus0.connect(chorus0Gain);
        chorus0.connect(effects);
        const chorus1 = audioCtx.createOscillator();
        chorus1.type = settingsBox.wave;
        chorus1.frequency.value = freq-parseInt(settingsBox.chorusTime);
        const chorus1Gain = audioCtx.createGain();            
        chorus1Gain.gain.value = !settingsBox['gain'+i]?0:(settingsBox['gain'+i])/100;
        chorus1.connect(chorus1Gain);
        chorus1.connect(effects);
        nodes[pitch].push(chorus0);
        nodes[pitch].push(chorus1);
      }
    }
    const limiter = this.state.limiter;
    effects.connect(limiter);

    this.setState({nodes:nodes},()=>{
      const newPitches = this.state.nodes[pitch]; 
      if(newPitches) {
        this.analyze();
        if(!this.state.lfo){
          this.startLfo();
        }
        for(let i=0;i<newPitches.length;i++){
          const note = newPitches[i];
          note.start();
        }
      }
    }); 
  }
  startLfo() {
    const audioCtx = this.state.audioCtx;
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const limiter = this.state.limiter;
    const settingsBox = this.state.stateBoxes[this.state.focusedBox];
    lfo.wave = settingsBox.wave;
    lfo.frequency.value = settingsBox.tremoloTime/100;
    lfoGain.gain.value = settingsBox.tremoloGain/100;
    lfo.connect(lfoGain);
    lfoGain.connect(limiter.gain);
    this.setState({lfo:lfo},()=>{
      lfo.start();
    });
  }
  analyze() {
    const analyser = this.state.analyser;
    if(this.state.scope){
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength*2);
      const canvas = document.getElementById("oscilliscope");
      const myCanvas = canvas.getContext("2d");
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvas.height;
      const colorType = this.state.scopeColorType;
      const colors = {
        'classic':['rgba(255,255,255,1)','rgba(0,0,0,1)'],
        'digital':['rgba(0,0,0,1)','rgba(0,255,65,1)'],
        'response':['#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)],
        'random':[this.state.randomColor1||'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),this.state.randomColor2||'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)],
        'shuffle':[this.state.randomColor1||'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),this.state.randomColor2||'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)],
      }
      const scopeColor = colors[this.state.colorScheme][1];
      const keyColor = colors[this.state.colorScheme][0];
      const scale = (this.state.scopeScale>0?this.state.scopeScale:0.5);
      const draw = () => {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        myCanvas.fillStyle = keyColor;
        myCanvas.fillRect(0, 0, canvasWidth, canvasHeight);
        myCanvas.lineWidth = 6;
        myCanvas.strokeStyle = (colorType==='color'?scopeColor:"#333");
        myCanvas.beginPath();
        for(let x=0;x<dataArray.length;x++){
          myCanvas.lineTo(x*4,  (canvasHeight/2)+(128-dataArray[x])*scale);
        }
        myCanvas.stroke();
      } 
      draw();
    }
  }
  stopTouch(pitch){
    if(!pitch&&pitch!==0){return;}
    const currentNotes = this.state.nodes;
    if(isNaN(pitch)){pitch = this.stringToPitch(pitch)}
    if(currentNotes[pitch]){
      if(Object.keys(this.state.nodes).length===1){
        this.setState({playTouchKeyboard:false},()=>{

          this.stopAllNotes();
        });
      } else if(Object.keys(this.state.nodes).length>1) {
        this.stopNote(pitch);
      }
    }
  }
  stopAllNotes() {
    const currentNotes = this.state.nodes;
    if(Object.keys(currentNotes)){
      const pitches = Object.keys(currentNotes);
      for(let i=0;i<pitches.length;i++) {
        const pitch = pitches[i];
        for(let y=0;y<currentNotes[pitch].length;y++){
          currentNotes[pitch][y].stop();
        }
      }
      clearTimeout(this.state.lfoTimeout);
      const timeout = setTimeout(()=>{
        if(this.state.lfo){
          const lfo = this.state.lfo;
          lfo.stop();
          this.setState({lfo:null,lfoTimeout:null})
        }
      },600);
      this.setState({nodes:{},playTouchKeyboard:false,lfoTimeout:timeout},()=>{
        if(this.state.colorScheme!=='shuffle'){this.analyze()};
      });
    }
  }
  stopNote(pitch) {
    if(!pitch&&pitch!==0){return;}
    let currentNotes = this.state.nodes;
    if(isNaN(pitch)){pitch = this.stringToPitch(pitch)}
    if(currentNotes[pitch]){
      for(let y=0;y<currentNotes[pitch].length;y++){
          currentNotes[pitch][y].stop();
      }
      delete currentNotes[pitch];
      if(Object.keys(currentNotes).length>0) {
        this.setState({nodes:currentNotes});
      } else {
        if(!this.state.playTouchKeyboard){
        this.stopAllNotes();
        }
      }
    }
  }
  resizeApp() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    this.setState({windowWidth:windowWidth,windowHeight:windowHeight});
  }
  listeners() {
    window.addEventListener('resize', this.resizeApp);
    //if the mouse click ends
    //    document.body.addEventListener('mouseup', this.stopAllNotes);
    //if mouse leaves the keys
    document.getElementById('touch-keyboard').addEventListener('mouseleave', this.setTouchKeyboard.bind(this, false));
    // if window loses focus
    window.addEventListener('blur',this.stopAllNotes);
    //if context menu is brought up
    document.body.addEventListener('contextmenu',(e)=>{
      if(!process.env.NODE_ENV||process.env.NODE_ENV!=='development'){
        e.preventDefault();e.stopPropagation();
      }
    });
    //if a new click happens
    window.addEventListener('click',(e)=>{
    });
    //Key Down Events
    document.body.addEventListener('keydown', (e)=>{
      const pitch = this.keyToPitch(e.which);
      this.playOrgan(pitch);
    });
    //if the keyboard goes up
    document.body.addEventListener('keyup', (e) => {
      const pitch = this.keyToPitch(e.which);
      this.stopNote(pitch);
    });
    //MIDI Events
    /*if(navigator&&navigator.requestMIDIAccess()){
      navigator.requestMIDIAccess()
      .then((access) => {
        console.log(access);
        const getMIDIMessage = message => {
          const pitch = this.midiToPitch(message.data[1]);
          console.log(pitch);
          if(message.data[0]===144){
            this.playOrgan(pitch);
          } else if(message.data[0]===128) {
            this.stopNote(pitch);
          }
        }
        for (let input of access.inputs.values()){
          input.onmidimessage = getMIDIMessage;
        }
      });
    }*/
  }
  refreshContext(func) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = audioCtx.createGain();            
    const analyser = audioCtx.createAnalyser();
    const convolver = audioCtx.createConvolver();
    const settingsBox = this.state.stateBoxes[this.state.focusedBox];
    const limiter = audioCtx.createGain();
    
    limiter.gain.value = (0.9*(settingsBox.chorusGain>0&&settingsBox.chorusTime>0?settingsBox.chorusGain/100:1)*(settingsBox.tremoloGain>0&&settingsBox.tremoloTime>0?settingsBox.tremoloGain/100:1))/(this.state.masterVolume>0?this.state.masterVolume/100:1);
    limiter.connect(masterGain);
    masterGain.gain.value = 0.4;
    masterGain.connect(analyser);  
    analyser.connect(audioCtx.destination);

    this.setState({audioCtx:audioCtx,masterGain:masterGain,analyser:analyser,convolver:convolver,limiter:limiter},()=>{
      if(func){
        func();
      }
    });
  }
  loadReverb(){
    let audioCtx = this.state.audioCtx;
    let masterGain = this.state.masterGain;            
    let analyser = this.state.analyser;
    let convolver = this.state.convolver;
    const url = (window.location.origin+'/ir/RedBridge.wav');
    fetch(url).then((res)=>{return res.arrayBuffer()}).then((audioData)=>{
      audioCtx.decodeAudioData(audioData, (buffer)=>{
        if(!buffer){
          masterGain.connect(analyser);   
        } else {
          convolver.buffer = buffer;
          const buffers = [buffer];
          this.setState({convolver:convolver,buffers:buffers},()=>{this.connectReverb()});       
        }        
      });
    });
  }
  connectReverb() {
    const masterGain = this.state.masterGain;
    const analyser = this.state.analyser;
    const convolver = this.state.convolver;
    if(this.state.reverb&&this.state.convolver){
      convolver.buffer = this.state.buffers[0];
      masterGain.connect(convolver);
      convolver.connect(analyser);
      this.setState({masterGain:masterGain,convolver:convolver,analyser:analyser},()=>{this.persistSession()});
    } else {
      convolver.buffer = null;
      masterGain.connect(analyser);
      this.setState({masterGain:masterGain,convolver:convolver,analyser:analyser},()=>{this.persistSession()});
    }
  }
  componentDidMount() {
    alert('You are about to play with music. Please keep your volume at an appropriate level.');
    this.refreshContext(()=>{
      this.loadReverb();
      this.listeners();
      this.analyze();
    });
    /*if(!window.sessionStorage.getItem('synth-state')){
      alert('You are about to play with music. Please keep your volume at an appropriate level.');
      this.refreshContext(()=>{
        this.loadReverb();
        this.listeners();
        this.analyze();
      });
    } else {
     this.restoreSession();
     this.listeners();
    }*/
  }
  componentWillUnmount() {
    this.state.audioCtx.close();  
  }
  render() { 
    let isMobile = this.state.windowWidth>980?false:true;
    let isPortrait = this.state.windowWidth>this.state.windowHeight?false:true;

    const appWidth = isPortrait?!isMobile?900:this.state.windowHeight-80:isMobile?this.state.windowWidth-80:900;
    const keyboardHeight = !isPortrait?
        this.state.windowHeight>516?
          400:this.state.windowHeight-76
        :isMobile?
          this.state.windowWidth>516?400:this.state.windowWidth-76
            :this.state.windowHeight>516?
              400
          :this.state.windowHeight-76;

    const scopeInputs = <Fragment>
      <div onClick={this.changeColors.bind(this, 'classic')} className={'button '+(this.state.colorScheme==='classic'?'highlight-button':'')}>Classic</div>
      <div onClick={this.changeColors.bind(this, 'digital')} className={'button '+(this.state.colorScheme==='digital'?'highlight-button':'')}>Digital</div>
      <div onClick={this.changeColors.bind(this, 'random')}  className={'button '+(this.state.colorScheme==='random'?'highlight-button':'')}>Random</div>
      <div onClick={this.changeColors.bind(this, 'response')}    className={'button '+(this.state.colorScheme==='response'?'highlight-button':'')}>Response</div>
      <div onClick={this.changeColors.bind(this, 'shuffle')}  className={'button '+(this.state.colorScheme==='shuffle'?'highlight-button':'')}>Shuffle</div>
    </Fragment>;
    const canvas = <div style={{position:'absolute',top:0,left:0,visibility:this.state.scope===true?'visible':'hidden'}}><canvas width={appWidth} height={keyboardHeight} id='oscilliscope'></canvas></div>;
    const keyWidth = isMobile?appWidth/8:appWidth/15;
    const whiteKey = {
      width: keyWidth,
      height:keyboardHeight,
      marginLeft:isMobile?-.25:-.15
    };
    const blackKey = {
      height:keyboardHeight*(3/5),
    };
    const box = this.state.stateBoxes[0];
    const focusedSetting = () =>{
      const wave = <Fragment>
        <label> 
          <select name='wave' value={box.wave} onChange={this.changeSetting.bind(this, box)}>
            <option value='sine'>Sine</option>
            <option value='square'>Square</option>
            <option value='sawtooth'>Sawtooth</option>
            <option value='triangle'>Triangle</option>
          </select>
        </label>
      </Fragment>;
      const tremolo = <Fragment>
        <label>Rate<input type='range' name='tremoloTime' min='100' max='1200' value={box.tremoloTime} onChange={this.changeSetting.bind(this, box)}></input></label>
        <label>Volume<input type='range' name='tremoloGain' min='0' max='70' value={box.tremoloGain} onChange={this.changeSetting.bind(this, box)}></input></label>
      </Fragment>;
      const chorus = <Fragment>
        <label>Detune<input type='range' name='chorusTime' min='1' max='16' value={box.chorusTime} onChange={this.changeSetting.bind(this, box)}></input></label>
        <label>Volume<input type='range' name='chorusGain' min='0' max='70' value={box.chorusGain} onChange={this.changeSetting.bind(this, box)}></input></label>
      </Fragment>;
      const osc = <Fragment>
        <label>Show Oscilliscope? <sup>(may impact performance)</sup><input type='checkbox' name='scope' checked={this.state.scope} onChange={this.inputChange}/></label>
        {this.state.scope===true?scopeInputs:null}
      </Fragment>;
      const boxes = {
        'wave':wave,
        'tremolo':tremolo,
        'chorus':chorus,
        'osc':osc
      }
      if(!this.state.focusedSetting||!boxes[this.state.focusedSetting]){return <div className='setting-wrapper'></div>}
      return <div className='setting-wrapper top'>{boxes[this.state.focusedSetting]}<div className='up-arrow' onClick={this.closeSettingBox.bind(this)}><div className='arrow'></div></div></div>;
    };
  const smallKeyboard = <Fragment>
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'c1')}  onTouchEnd={this.stopTouch.bind(this,'c1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'c1')}  onMouseEnter={this.touchOrgan.bind(this,'c1')}  onMouseLeave={this.stopNote.bind(this,'c1')}  id='c1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'c#1')} onTouchEnd={this.stopTouch.bind(this,'c#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'c#1')} onMouseEnter={this.touchOrgan.bind(this,'c#1')} onMouseLeave={this.stopNote.bind(this,'c#1')} id='c#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'d1')}  onTouchEnd={this.stopTouch.bind(this,'d1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'d1')}  onMouseEnter={this.touchOrgan.bind(this,'d1')}  onMouseLeave={this.stopNote.bind(this,'d1')}  id='d1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'d#1')} onTouchEnd={this.stopTouch.bind(this,'d#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'d#1')} onMouseEnter={this.touchOrgan.bind(this,'d#1')} onMouseLeave={this.stopNote.bind(this,'d#1')} id='d#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'e1')}  onTouchEnd={this.stopTouch.bind(this,'e1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'e1')}  onMouseEnter={this.touchOrgan.bind(this,'e1')}  onMouseLeave={this.stopNote.bind(this,'e1')}  id='e1' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'f1')}  onTouchEnd={this.stopTouch.bind(this,'f1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'f1')}  onMouseEnter={this.touchOrgan.bind(this,'f1')}  onMouseLeave={this.stopNote.bind(this,'f1')}  id='f1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'f#1')} onTouchEnd={this.stopTouch.bind(this,'f#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'f#1')} onMouseEnter={this.touchOrgan.bind(this,'f#1')} onMouseLeave={this.stopNote.bind(this,'f#1')} id='f#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'g1')}  onTouchEnd={this.stopTouch.bind(this,'g1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'g1')}  onMouseEnter={this.touchOrgan.bind(this,'g1')}  onMouseLeave={this.stopNote.bind(this,'g1')}  id='g1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'g#1')} onTouchEnd={this.stopTouch.bind(this,'g#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'g#1')} onMouseEnter={this.touchOrgan.bind(this,'g#1')} onMouseLeave={this.stopNote.bind(this,'g#1')} id='g#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'a1')}  onTouchEnd={this.stopTouch.bind(this,'a1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'a1')}  onMouseEnter={this.touchOrgan.bind(this,'a1')}  onMouseLeave={this.stopNote.bind(this,'a1')}  id='a1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'a#1')} onTouchEnd={this.stopTouch.bind(this,'a#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'a#1')} onMouseEnter={this.touchOrgan.bind(this,'a#1')} onMouseLeave={this.stopNote.bind(this,'a#1')} id='a#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'b1')}  onTouchEnd={this.stopTouch.bind(this,'b1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'b1')}  onMouseEnter={this.touchOrgan.bind(this,'b1')}  onMouseLeave={this.stopNote.bind(this,'b1')}  id='b1' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'c2')}  onTouchEnd={this.stopTouch.bind(this,'c2')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'c2')}  onMouseEnter={this.touchOrgan.bind(this,'c2')}  onMouseLeave={this.stopNote.bind(this,'c2')}  id='c2' style={whiteKey} />
  </Fragment>;
  const fullKeyBoard = <Fragment>
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'c')}  onTouchEnd={this.stopTouch.bind(this,'c')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'c')}  onMouseEnter={this.touchOrgan.bind(this,'c')}  onMouseLeave={this.stopNote.bind(this,'c')}  id='c' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'c#')} onTouchEnd={this.stopTouch.bind(this,'c#')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'c#')} onMouseEnter={this.touchOrgan.bind(this,'c#')} onMouseLeave={this.stopNote.bind(this,'c#')} id='c#' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'d')}  onTouchEnd={this.stopTouch.bind(this,'d')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'d')}  onMouseEnter={this.touchOrgan.bind(this,'d')}  onMouseLeave={this.stopNote.bind(this,'d')}  id='d' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'d#')} onTouchEnd={this.stopTouch.bind(this,'d#')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'d#')} onMouseEnter={this.touchOrgan.bind(this,'d#')} onMouseLeave={this.stopNote.bind(this,'d#')} id='d#' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'e')}  onTouchEnd={this.stopTouch.bind(this,'e')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'e')}  onMouseEnter={this.touchOrgan.bind(this,'e')}  onMouseLeave={this.stopNote.bind(this,'e')}  id='e' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'f')}  onTouchEnd={this.stopTouch.bind(this,'f')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'f')}  onMouseEnter={this.touchOrgan.bind(this,'f')}  onMouseLeave={this.stopNote.bind(this,'f')}  id='f' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'f#')} onTouchEnd={this.stopTouch.bind(this,'f#')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'f#')} onMouseEnter={this.touchOrgan.bind(this,'f#')} onMouseLeave={this.stopNote.bind(this,'f#')} id='f#' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'g')}  onTouchEnd={this.stopTouch.bind(this,'g')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'g')}  onMouseEnter={this.touchOrgan.bind(this,'g')}  onMouseLeave={this.stopNote.bind(this,'g')}  id='g' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'g#')} onTouchEnd={this.stopTouch.bind(this,'g#')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'g#')} onMouseEnter={this.touchOrgan.bind(this,'g#')} onMouseLeave={this.stopNote.bind(this,'g#')} id='g#' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'a')}  onTouchEnd={this.stopTouch.bind(this,'a')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'a')}  onMouseEnter={this.touchOrgan.bind(this,'a')}  onMouseLeave={this.stopNote.bind(this,'a')}  id='a' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'a#')} onTouchEnd={this.stopTouch.bind(this,'a#')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'a#')} onMouseEnter={this.touchOrgan.bind(this,'a#')} onMouseLeave={this.stopNote.bind(this,'a#')} id='a#' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'b')}  onTouchEnd={this.stopTouch.bind(this,'b')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'b')}  onMouseEnter={this.touchOrgan.bind(this,'b')}  onMouseLeave={this.stopNote.bind(this,'b')}  id='b' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'c1')}  onTouchEnd={this.stopTouch.bind(this,'c1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'c1')}  onMouseEnter={this.touchOrgan.bind(this,'c1')}  onMouseLeave={this.stopNote.bind(this,'c1')}  id='c1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'c#1')} onTouchEnd={this.stopTouch.bind(this,'c#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'c#1')} onMouseEnter={this.touchOrgan.bind(this,'c#1')} onMouseLeave={this.stopNote.bind(this,'c#1')} id='c#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'d1')}  onTouchEnd={this.stopTouch.bind(this,'d1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'d1')}  onMouseEnter={this.touchOrgan.bind(this,'d1')}  onMouseLeave={this.stopNote.bind(this,'d1')}  id='d1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'d#1')} onTouchEnd={this.stopTouch.bind(this,'d#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'d#1')} onMouseEnter={this.touchOrgan.bind(this,'d#1')} onMouseLeave={this.stopNote.bind(this,'d#1')} id='d#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'e1')}  onTouchEnd={this.stopTouch.bind(this,'e1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'e1')}  onMouseEnter={this.touchOrgan.bind(this,'e1')}  onMouseLeave={this.stopNote.bind(this,'e1')}  id='e1' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'f1')}  onTouchEnd={this.stopTouch.bind(this,'f1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'f1')}  onMouseEnter={this.touchOrgan.bind(this,'f1')}  onMouseLeave={this.stopNote.bind(this,'f1')}  id='f1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'f#1')} onTouchEnd={this.stopTouch.bind(this,'f#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'f#1')} onMouseEnter={this.touchOrgan.bind(this,'f#1')} onMouseLeave={this.stopNote.bind(this,'f#1')} id='f#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'g1')}  onTouchEnd={this.stopTouch.bind(this,'g1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'g1')}  onMouseEnter={this.touchOrgan.bind(this,'g1')}  onMouseLeave={this.stopNote.bind(this,'g1')}  id='g1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'g#1')} onTouchEnd={this.stopTouch.bind(this,'g#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'g#1')} onMouseEnter={this.touchOrgan.bind(this,'g#1')} onMouseLeave={this.stopNote.bind(this,'g#1')} id='g#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'a1')}  onTouchEnd={this.stopTouch.bind(this,'a1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'a1')}  onMouseEnter={this.touchOrgan.bind(this,'a1')}  onMouseLeave={this.stopNote.bind(this,'a1')}  id='a1' style={whiteKey} />
    <button className='synth-key black-key' type='button' onTouchStart={this.playOrgan.bind(this,'a#1')} onTouchEnd={this.stopTouch.bind(this,'a#1')} onMouseUp={this.stopAllNotes.bind(this)} onMouseDown={this.playOrgan.bind(this,'a#1')} onMouseEnter={this.touchOrgan.bind(this,'a#1')} onMouseLeave={this.stopNote.bind(this,'a#1')} id='a#1' style={blackKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'b1')}  onTouchEnd={this.stopTouch.bind(this,'b1')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'b1')}  onMouseEnter={this.touchOrgan.bind(this,'b1')}  onMouseLeave={this.stopNote.bind(this,'b1')}  id='b1' style={whiteKey} />
    <button className='synth-key white-key' type='button' onTouchStart={this.playOrgan.bind(this,'c2')}  onTouchEnd={this.stopTouch.bind(this,'c2')}  onMouseUp={this.stopAllNotes.bind(this)}  onMouseDown={this.playOrgan.bind(this,'c2')}  onMouseEnter={this.touchOrgan.bind(this,'c2')}  onMouseLeave={this.stopNote.bind(this,'c2')}  id='c2' style={whiteKey} />
  </Fragment>;
    return (<div id='synth' style={{width:appWidth+80,margin:'0 auto'}}>
      <div id='keyboard' >
        <div style={{position:'relative'}}>
          <div id='settings'>
            <div id='wave' onClick={this.showSetting.bind(this, 'wave')} className={'button '+(this.state.focusedSetting==='wave'?'highlight-button':null)}>WAVE</div>
            <div id='tremolo' onClick={this.showSetting.bind(this, 'tremolo')} className={'button '+(this.state.focusedSetting==='tremolo'?'highlight-button':null)}>TREMOLO</div>
            <div id='chorus' onClick={this.showSetting.bind(this, 'chorus')} className={'button '+(this.state.focusedSetting==='chorus'?'highlight-button':null)}>CHORUS</div>
            <div id='reverb' onClick={this.reverbSwitch.bind(this)} className={'button '+(!this.state.convolver?'hidden':!this.state.reverb?'':'highlight-button')}>REVERB</div>
            <div id='osc' onClick={this.showSetting.bind(this, 'osc')} className={'button '+(this.state.focusedSetting==='osc'?'highlight-button':null)}>OSC</div>
            <div className='range'><input type='range' name='masterVolume' min='0' max='800' value={this.state.stateBoxes[0].masterVolume} onChange={this.changeSetting.bind(this, box)}></input></div>
          </div>
          {focusedSetting()}
        </div>
        <div id='touch-keyboard' onTouchStart={this.setTouchKeyboard.bind(this, true)} onMouseDown={this.setTouchKeyboard.bind(this, true)}  className="touch-keys">
            {this.state.scope === true?canvas:null}
            {isMobile?smallKeyboard:fullKeyBoard}
        </div>
      </div>
    </div>)
  }
} export default Synth;





