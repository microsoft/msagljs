"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([[900],{2134:(e,t,r)=>{r.d(t,{A:()=>s});var a=r(6681);function s(){return(0,a.A)()?document.firstElementChild.dataset.theme:"dark"}},8900:(e,t,r)=>{r.r(t),r.d(t,{default:()=>l});var a=r(3696);const s={iframeEditor:"iframeEditor_p77_"};var n=r(8017),o=r(2134),i=r(883);function l(e){const{config:t,source:r={}}=e,{text:l}=r,{id:d,title:c,lightUrl:m,darkUrl:u,message:w={},readyMessage:f,className:p,messageTextFieldName:g="text",messageIdFieldName:b="mid",allow:h="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; usb; xr-spatial-tracking; serial; bluetooth",sandbox:E="allow-forms allow-scripts allow-downloads allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"}=t,v=(0,o.A)(),k=(0,i.A)("dark"===v?u:m),x=`${d}-editor-frame`,y=(0,a.useRef)(null),A=()=>{const e=y.current,t=e?.contentWindow;if(!t)return;const r=Math.random()+"",a={...w,[b]:r,[g]:l};t.postMessage(a,"*")};return(0,a.useEffect)((()=>A()),[k,r]),(0,a.useEffect)((()=>{if(!f||"undefined"==typeof window)return;const e=y.current,t=e?.contentWindow;if(!t)return;const r=e=>{const{data:t}=e;Object.entries(f).every((e=>{let[r,a]=e;return t[r]===f[r]}))&&(window.removeEventListener("message",r),A())};return window.addEventListener("message",r),()=>{window.removeEventListener("message",r)}}),[k]),a.createElement("iframe",{id:x,"aria-label":c||d,ref:y,className:(0,n.A)(s.iframeEditor,p),allow:h,sandbox:E,src:k})}}}]);