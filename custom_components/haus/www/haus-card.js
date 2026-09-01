/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),i=new WeakMap;let r=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const s=this.t;if(e&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=i.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&i.set(s,t))}return t}toString(){return this.cssText}};const o=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,s,i)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[i+1],t[0]);return new r(i,t,s)},n=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return(t=>new r("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:a,defineProperty:h,getOwnPropertyDescriptor:l,getOwnPropertyNames:c,getOwnPropertySymbols:d,getPrototypeOf:p}=Object,u=globalThis,$=u.trustedTypes,f=$?$.emptyScript:"",g=u.reactiveElementPolyfillSupport,_=(t,e)=>t,m={toAttribute(t,e){switch(e){case Boolean:t=t?f:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch(t){s=null}}return s}},y=(t,e)=>!a(t,e),v={attribute:!0,type:String,converter:m,reflect:!1,useDefault:!1,hasChanged:y};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),u.litPropertyMetadata??=new WeakMap;let A=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=v){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);void 0!==i&&h(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:r}=l(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:i,set(e){const o=i?.call(this);r?.call(this,e),this.requestUpdate(t,o,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??v}static _$Ei(){if(this.hasOwnProperty(_("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(_("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(_("properties"))){const t=this.properties,e=[...c(t),...d(t)];for(const s of e)this.createProperty(s,t[s])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,s]of e)this.elementProperties.set(t,s)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const t of s)e.unshift(n(t))}else void 0!==t&&e.push(n(t));return e}static _$Eu(t,e){const s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,i)=>{if(e)s.adoptedStyleSheets=i.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of i){const i=document.createElement("style"),r=t.litNonce;void 0!==r&&i.setAttribute("nonce",r),i.textContent=e.cssText,s.appendChild(i)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(void 0!==i&&!0===s.reflect){const r=(void 0!==s.converter?.toAttribute?s.converter:m).toAttribute(e,s.type);this._$Em=t,null==r?this.removeAttribute(i):this.setAttribute(i,r),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(void 0!==i&&this._$Em!==i){const t=s.getPropertyOptions(i),r="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:m;this._$Em=i;const o=r.fromAttribute(e,t.type);this[i]=o??this._$Ej?.get(i)??o,this._$Em=null}}requestUpdate(t,e,s,i=!1,r){if(void 0!==t){const o=this.constructor;if(!1===i&&(r=this[t]),s??=o.getPropertyOptions(t),!((s.hasChanged??y)(r,e)||s.useDefault&&s.reflect&&r===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,s))))return;this.C(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:r},o){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==r||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),!0===i&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,s]of t){const{wrapped:t}=s,i=this[e];!0!==t||this._$AL.has(e)||void 0===i||this.C(e,void 0,s,i)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};A.elementStyles=[],A.shadowRootOptions={mode:"open"},A[_("elementProperties")]=new Map,A[_("finalized")]=new Map,g?.({ReactiveElement:A}),(u.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const x=globalThis,b=t=>t,w=x.trustedTypes,E=w?w.createPolicy("lit-html",{createHTML:t=>t}):void 0,S="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,k="?"+C,P=`<${k}>`,U=document,H=()=>U.createComment(""),M=t=>null===t||"object"!=typeof t&&"function"!=typeof t,O=Array.isArray,N="[ \t\n\f\r]",R=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,T=/-->/g,z=/>/g,I=RegExp(`>|${N}(?:([^\\s"'>=/]+)(${N}*=${N}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),D=/'/g,j=/"/g,B=/^(?:script|style|textarea|title)$/i,L=t=>(e,...s)=>({_$litType$:t,strings:e,values:s}),W=L(1),q=L(2),V=Symbol.for("lit-noChange"),F=Symbol.for("lit-nothing"),J=new WeakMap,K=U.createTreeWalker(U,129);function Z(t,e){if(!O(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==E?E.createHTML(e):e}const G=(t,e)=>{const s=t.length-1,i=[];let r,o=2===e?"<svg>":3===e?"<math>":"",n=R;for(let e=0;e<s;e++){const s=t[e];let a,h,l=-1,c=0;for(;c<s.length&&(n.lastIndex=c,h=n.exec(s),null!==h);)c=n.lastIndex,n===R?"!--"===h[1]?n=T:void 0!==h[1]?n=z:void 0!==h[2]?(B.test(h[2])&&(r=RegExp("</"+h[2],"g")),n=I):void 0!==h[3]&&(n=I):n===I?">"===h[0]?(n=r??R,l=-1):void 0===h[1]?l=-2:(l=n.lastIndex-h[2].length,a=h[1],n=void 0===h[3]?I:'"'===h[3]?j:D):n===j||n===D?n=I:n===T||n===z?n=R:(n=I,r=void 0);const d=n===I&&t[e+1].startsWith("/>")?" ":"";o+=n===R?s+P:l>=0?(i.push(a),s.slice(0,l)+S+s.slice(l)+C+d):s+C+(-2===l?e:d)}return[Z(t,o+(t[s]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),i]};class Q{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let r=0,o=0;const n=t.length-1,a=this.parts,[h,l]=G(t,e);if(this.el=Q.createElement(h,s),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(i=K.nextNode())&&a.length<n;){if(1===i.nodeType){if(i.hasAttributes())for(const t of i.getAttributeNames())if(t.endsWith(S)){const e=l[o++],s=i.getAttribute(t).split(C),n=/([.?@])?(.*)/.exec(e);a.push({type:1,index:r,name:n[2],strings:s,ctor:"."===n[1]?st:"?"===n[1]?it:"@"===n[1]?rt:et}),i.removeAttribute(t)}else t.startsWith(C)&&(a.push({type:6,index:r}),i.removeAttribute(t));if(B.test(i.tagName)){const t=i.textContent.split(C),e=t.length-1;if(e>0){i.textContent=w?w.emptyScript:"";for(let s=0;s<e;s++)i.append(t[s],H()),K.nextNode(),a.push({type:2,index:++r});i.append(t[e],H())}}}else if(8===i.nodeType)if(i.data===k)a.push({type:2,index:r});else{let t=-1;for(;-1!==(t=i.data.indexOf(C,t+1));)a.push({type:7,index:r}),t+=C.length-1}r++}}static createElement(t,e){const s=U.createElement("template");return s.innerHTML=t,s}}function X(t,e,s=t,i){if(e===V)return e;let r=void 0!==i?s._$Co?.[i]:s._$Cl;const o=M(e)?void 0:e._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),void 0===o?r=void 0:(r=new o(t),r._$AT(t,s,i)),void 0!==i?(s._$Co??=[])[i]=r:s._$Cl=r),void 0!==r&&(e=X(t,r._$AS(t,e.values),r,i)),e}class Y{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??U).importNode(e,!0);K.currentNode=i;let r=K.nextNode(),o=0,n=0,a=s[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new tt(r,r.nextSibling,this,t):1===a.type?e=new a.ctor(r,a.name,a.strings,this,t):6===a.type&&(e=new ot(r,this,t)),this._$AV.push(e),a=s[++n]}o!==a?.index&&(r=K.nextNode(),o++)}return K.currentNode=U,i}p(t){let e=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=F,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=X(this,t,e),M(t)?t===F||null==t||""===t?(this._$AH!==F&&this._$AR(),this._$AH=F):t!==this._$AH&&t!==V&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>O(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==F&&M(this._$AH)?this._$AA.nextSibling.data=t:this.T(U.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=Q.createElement(Z(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const t=new Y(i,this),s=t.u(this.options);t.p(e),this.T(s),this._$AH=t}}_$AC(t){let e=J.get(t.strings);return void 0===e&&J.set(t.strings,e=new Q(t)),e}k(t){O(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const r of t)i===e.length?e.push(s=new tt(this.O(H()),this.O(H()),this,this.options)):s=e[i],s._$AI(r),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=b(t).nextSibling;b(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,r){this.type=1,this._$AH=F,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=r,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=F}_$AI(t,e=this,s,i){const r=this.strings;let o=!1;if(void 0===r)t=X(this,t,e,0),o=!M(t)||t!==this._$AH&&t!==V,o&&(this._$AH=t);else{const i=t;let n,a;for(t=r[0],n=0;n<r.length-1;n++)a=X(this,i[s+n],e,n),a===V&&(a=this._$AH[n]),o||=!M(a)||a!==this._$AH[n],a===F?t=F:t!==F&&(t+=(a??"")+r[n+1]),this._$AH[n]=a}o&&!i&&this.j(t)}j(t){t===F?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class st extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===F?void 0:t}}class it extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==F)}}class rt extends et{constructor(t,e,s,i,r){super(t,e,s,i,r),this.type=5}_$AI(t,e=this){if((t=X(this,t,e,0)??F)===V)return;const s=this._$AH,i=t===F&&s!==F||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,r=t!==F&&(s===F||i);i&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class ot{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){X(this,t)}}const nt=x.litHtmlPolyfillSupport;nt?.(Q,tt),(x.litHtmlVersions??=[]).push("3.3.3");const at=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class ht extends A{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,s)=>{const i=s?.renderBefore??e;let r=i._$litPart$;if(void 0===r){const t=s?.renderBefore??null;i._$litPart$=r=new tt(e.insertBefore(H(),t),t,void 0,s??{})}return r._$AI(t),r})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return V}}ht._$litElement$=!0,ht.finalized=!0,at.litElementHydrateSupport?.({LitElement:ht});const lt=at.litElementPolyfillSupport;lt?.({LitElement:ht}),(at.litElementVersions??=[]).push("4.2.2");const ct={hygiene:"#2f6fd0",usage:"#0e9384",diversity:"#b5750a",users:"#c2456e"},dt=["hygiene","usage","diversity","users"],pt={hygiene:"Hygiene",usage:"Usage",diversity:"Diversity",users:"Users"},ut="sensor.haus_score",$t=176,ft="haus-card",gt={type:`custom:${ft}`,entity:ut},_t=`${ft}-editor`;class mt extends ht{constructor(){super(...arguments),this._config={type:`custom:${ft}`}}setConfig(t){this._config=t,this.requestUpdate()}render(){return W`
      <div class="form">
        <label>
          <span>Score entity</span>
          <input
            name="entity"
            type="text"
            .value=${this._config.entity??ut}
            @change=${this._valueChanged}
          />
        </label>
        <label>
          <span>Name</span>
          <input
            name="name"
            type="text"
            .value=${this._config.name??""}
            @change=${this._valueChanged}
          />
        </label>
      </div>
    `}_valueChanged(t){const e=t.target,s=e.value.trim(),i={...this._config};""===s?delete i[e.name]:i[e.name]=s,this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._config},bubbles:!0,composed:!0}))}}mt.styles=o`
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    input {
      font: inherit;
      font-size: 14px;
      padding: 8px;
      color: var(--primary-text-color);
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 4px;
    }
  `,customElements.get(_t)||customElements.define(_t,mt);const yt=88;class vt extends ht{constructor(){super(...arguments),this._entityId=ut}setConfig(t){const e=t?.entity;if(void 0!==e){if("string"!=typeof e)throw new Error('haus-card: "entity" must be an entity id, for example sensor.haus_score');if(!e.startsWith("sensor."))throw new Error(`haus-card: "${e}" is not a sensor. Point "entity" at the HAUS score sensor, for example sensor.haus_score`)}this._entityId=e??ut}getConfigEntity(){return this._entityId}set hass(t){const e=t.states[this._entityId];this._hass=t,e!==this._entityState&&(this._entityState=e,this.requestUpdate())}get hass(){return this._hass}getCardSize(){return 5}static getStubConfig(){return gt}static getConfigElement(){return document.createElement(`${ft}-editor`)}render(){const t=this._entityState;if(void 0===t)return W`
        <ha-card>
          <div class="pad missing">
            Entity <code>${this._entityId}</code> was not found. Is the HAUS
            integration set up?
          </div>
        </ha-card>
      `;const e=t.attributes,s=e.effective_weights??{},i=e.contributions??{},r=e.pillars??{hygiene:null,usage:0,diversity:0,users:0},o=!1===e.haghs_available,n=function(t,e){const s=(e.size-e.strokeWidth)/2,i=2*Math.PI*s;let r=0;const o=[];for(const s of t){const t=s.points/100*i,n=Math.max(0,t-e.gap);o.push({key:s.key,length:n,dashArray:`${n} ${i}`,dashOffset:-r}),r+=t}const n=t.reduce((t,e)=>t+e.points,0);return{radius:s,circumference:i,segments:o,earned:n,unearned:Math.max(0,100-n)}}(dt.filter(t=>void 0!==i[t]).map(t=>({key:t,points:i[t]})),{size:$t,strokeWidth:13,gap:2});return W`
      <ha-card>
        <div class="hero">
          <div class="ring-wrap">
            <svg
              class="ring"
              viewBox="0 0 ${$t} ${$t}"
              width="${$t}"
              height="${$t}"
              role="img"
              aria-label="HAUS score ${t.state} out of 100"
            >
              <g transform="rotate(-90 ${yt} ${yt})">
                <circle
                  class="track"
                  cx="${yt}"
                  cy="${yt}"
                  r="${n.radius}"
                  fill="none"
                  stroke-width="${13}"
                />
                ${n.segments.map(t=>q`
                    <circle
                      class="segment"
                      cx="${yt}"
                      cy="${yt}"
                      r="${n.radius}"
                      fill="none"
                      stroke="${ct[t.key]}"
                      stroke-width="${13}"
                      stroke-dasharray="${t.dashArray}"
                      stroke-dashoffset="${t.dashOffset}"
                      stroke-linecap="butt"
                    />
                  `)}
              </g>
            </svg>
            <div class="centre">
              <div class="score">${t.state}</div>
              <div class="scale">/ 100</div>
              <div class="tier">${e.tier??""}</div>
            </div>
          </div>
          <div class="pillars">
            ${dt.map(t=>this._pillarRow(t,r[t],s[t]))}
          </div>
        </div>
        <div class="footer">
          ${this._sparkline(e.score_history??[])}
          <div class="next-action">${function(t,e){let s,i=0;for(const r of dt){const o=t[r],n=e[r];if(null==o||void 0===n)continue;const a=(100-o)*n;a>i&&(i=a,s=r)}return void 0===s||i<1?"Nothing obvious left to improve.":`Best next gain: ${pt[s]}, worth ${i.toFixed(0)} points.`}(r,s)}</div>
          ${o?W`<div class="cta">
                HAGHS is not installed, so hygiene is dropped and the other three
                pillars are renormalised over the full scale.
              </div>`:F}
        </div>
      </ha-card>
    `}_pillarRow(t,e,s){const i=null==e,r=ct[t];return W`
      <div class="pillar-row ${i?"ghost":""}">
        <span class="swatch" style="background:${r}"></span>
        <span class="name">${pt[t]}</span>
        <span class="score">${i?"unavailable":Math.round(e)}</span>
        <span class="weight">
          ${void 0===s?"—":`${Math.round(100*s)}%`}
        </span>
        <span class="bar">
          ${i?F:W`<span
                class="bar-fill"
                style="width:${Math.max(0,Math.min(100,e))}%;background:${r}"
              ></span>`}
        </span>
      </div>
    `}_sparkline(t){if(t.length<2)return W`<div class="sparkline empty">
        Building history: one point a week.
      </div>`;const e=t.map(t=>t.score),s=Math.min(...e),i=Math.max(...e)-s||1,r=168/(e.length-1),o=e.map((t,e)=>{const o=28-(t-s)/i*28;return`${(e*r).toFixed(1)},${o.toFixed(1)}`}).join(" ");return W`
      <svg
        class="sparkline"
        viewBox="0 0 ${168} ${28}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Score over the last ${t.length} weeks"
      >
        <polyline points="${o}" fill="none" stroke-width="2" />
      </svg>
    `}}vt.styles=o`
    :host {
      display: block;
    }
    .pad {
      padding: 16px;
    }
    .missing {
      color: var(--secondary-text-color);
    }
    .hero {
      display: flex;
      gap: 20px;
      align-items: center;
      padding: 16px;
      flex-wrap: wrap;
    }
    .ring-wrap {
      position: relative;
      width: ${$t}px;
      height: ${$t}px;
      flex: 0 0 auto;
    }
    .track {
      stroke: var(--divider-color);
      opacity: 0.4;
    }
    .centre {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.1;
    }
    .centre .score {
      font-size: 44px;
      font-weight: 600;
      color: var(--primary-text-color);
    }
    .centre .scale {
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .centre .tier {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .pillars {
      flex: 1 1 220px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 220px;
    }
    .pillar-row {
      display: grid;
      grid-template-columns: 10px 1fr auto auto;
      grid-template-areas: "swatch name score weight" "bar bar bar bar";
      gap: 4px 8px;
      align-items: center;
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .swatch {
      grid-area: swatch;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .name {
      grid-area: name;
    }
    .pillar-row .score {
      grid-area: score;
      font-variant-numeric: tabular-nums;
    }
    .weight {
      grid-area: weight;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      grid-area: bar;
      display: block;
      height: 4px;
      border-radius: 2px;
      background: var(--divider-color);
      overflow: hidden;
    }
    .bar-fill {
      display: block;
      height: 100%;
    }
    .ghost .swatch,
    .ghost .bar-fill {
      opacity: 0.35;
    }
    .ghost .score {
      color: var(--secondary-text-color);
      font-style: italic;
    }
    .ghost .bar {
      background: transparent;
      border-top: 2px dashed var(--divider-color);
      height: 0;
    }
    .footer {
      border-top: 1px solid var(--divider-color);
      padding: 12px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sparkline {
      width: 100%;
      height: ${28}px;
    }
    .sparkline polyline {
      stroke: var(--secondary-text-color);
    }
    .sparkline.empty {
      height: auto;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .next-action,
    .cta {
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .cta {
      color: var(--primary-text-color);
      opacity: 0.85;
    }
  `,customElements.get(ft)||customElements.define(ft,vt);const At=window;At.customCards=[...At.customCards??[],{type:ft,name:"HAUS",description:"How much of Home Assistant this instance actually uses.",preview:!0}];export{vt as HausCard};
