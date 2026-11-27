import { NODE_W, NODE_H } from './flow-model.js'

export const CSS = `
.aimrule-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:1.5;display:flex;flex-direction:column;overflow:hidden;
  --aim-action:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#0f1115));
  --aim-action-ink:var(--dsw-alias-label-primary-foreground,#fff);
  --aim-action-hover:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#3c3c3d));
  --aim-accent:var(--dsw-alias-state-business-primary,#4176e6);
  --aim-accent-soft:color-mix(in srgb, var(--aim-accent) 12%, transparent);
  --aim-line:var(--dsw-alias-border-l3);--aim-line-strong:var(--dsw-alias-border-l4);
  --aim-muted:var(--dsw-alias-label-tertiary);--aim-text:var(--dsw-alias-label-primary);
  --aim-base:var(--dsw-alias-bg-base);--aim-layer:var(--dsw-alias-bg-layer-1);--aim-raised:var(--dsw-alias-bg-layer-2);
  --aim-hover:var(--dsw-alias-interactive-bg-hover);--aim-danger:var(--dsw-alias-state-error-primary);
  --aimrule-start:var(--dsw-static-green-500,#22c55e);--aimrule-judge:var(--dsw-static-amber-500,#f59e0b);
  --aimrule-calc:var(--dsw-static-blue-500,#3b82f6);--aimrule-action:var(--dsw-static-violet-600,#7c3aed);
  --aimrule-end:var(--dsw-static-red-500,#ef4444);--aimrule-module:var(--dsw-static-neutral-bluish-500,#979da6);
  --aimrule-edge:color-mix(in srgb, var(--aim-text) 30%, transparent);
  --aimrule-grid:color-mix(in srgb, var(--aim-text) 9%, transparent);}
body[data-ds-dark-theme] .aimrule-root{
  --aimrule-start:var(--dsw-static-green-400,#4ed17e);--aimrule-judge:var(--dsw-static-amber-400,#f7ad31);
  --aimrule-calc:var(--dsw-static-blue-400,#60a5fa);--aimrule-action:var(--dsw-static-violet-400,#a78bfa);
  --aimrule-end:var(--dsw-static-red-400,#f25a5a);--aimrule-module:var(--dsw-static-neutral-bluish-400,#adb2b8);}
.aimrule-root *{box-sizing:border-box}
body:not([data-ds-dark-theme]) .aimrule-root{--aim-muted:#6b7075}
.aimrule-root ::selection{background:var(--aim-accent-soft)}
.aimrule-top{display:flex;align-items:center;gap:8px;container-type:inline-size;padding:calc(8px + var(--dsh-frame-top-clearance,0px)) 14px 8px;min-height:calc(52px + var(--dsh-frame-top-clearance,0px));flex:none;flex-wrap:wrap;border-bottom:.5px solid var(--aim-line);background:var(--aim-base);position:relative;z-index:8}
.aimrule-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:none}
.aimrule-logo{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-title-wrap{position:relative;display:flex;align-items:center;gap:1px;flex:none}
.aimrule-title-more{width:auto;height:26px;padding:0 8px;border:.5px solid var(--aim-line);border-radius:7px;background:var(--aim-layer);color:var(--aim-muted);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none}
.aimrule-title-more:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-title-more:disabled{opacity:.4;cursor:default}
.aimrule-title-more-chevron{font-size:9px;opacity:.75}
.aimrule-title{font:inherit;font-size:14px;font-weight:600;color:var(--aim-text);background:transparent;border:1px solid transparent;border-radius:7px;padding:4px 7px;max-width:280px;outline:none;flex:none}
.aimrule-title:hover{border-color:var(--aim-line)}
.aimrule-title:focus{border-color:var(--aim-accent);background:var(--aim-layer)}
.aimrule-crumbs{display:flex;align-items:center;gap:1px;min-width:0;overflow:hidden;padding-left:2px}
.aimrule-crumb{font:inherit;font-size:12px;border:0;background:transparent;color:var(--aim-muted);padding:3px 6px;border-radius:6px;cursor:pointer;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis}
.aimrule-crumb:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-crumb[data-current=true]{color:var(--aim-text);font-weight:600}
.aimrule-canvas-crumbs{position:absolute;left:14px;top:12px;z-index:6;display:flex;align-items:center;gap:1px;padding:2px;border:.5px solid var(--aim-line);border-radius:999px;background:color-mix(in srgb, var(--aim-layer) 90%, transparent);backdrop-filter:blur(12px);box-shadow:0 6px 18px rgba(0,0,0,.10);max-width:calc(100% - 28px);overflow:auto}
.aimrule-crumb-home{height:24px;padding:0 9px;border:0;border-radius:999px;background:var(--aim-accent-soft);color:var(--aim-accent);font:inherit;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none}
.aimrule-crumb-home:hover{background:color-mix(in srgb, var(--aim-accent) 20%, transparent)}
.aimrule-canvas-crumbs .aimrule-crumb{height:24px;padding:0 7px;font-size:11px;border-radius:999px;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.aimrule-canvas-crumbs .aimrule-crumb[data-current=true]{cursor:default}
.aimrule-crumb-wrap{display:inline-flex;align-items:center;gap:1px;min-width:0}
.aimrule-crumb-sep{color:var(--aim-muted);font-size:11px;opacity:.7}
.aimrule-sync{display:inline-flex;align-items:center;gap:5px;flex:none;font-size:11px;color:var(--aim-muted);white-space:nowrap}
.aimrule-sync::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent)}
.aimrule-sync[data-state=local]{color:var(--dsw-alias-state-warn-primary)}
.aimrule-sync[data-state=local]::before{background:var(--dsw-alias-state-warn-primary);box-shadow:none}
.aimrule-sync[data-state=loading]::before{background:var(--aim-muted);box-shadow:none}
.aimrule-actions{display:flex;align-items:center;gap:6px;margin-left:auto}
.aimrule-top-tools{display:flex;align-items:center;gap:1px;padding:1px;border:.5px solid var(--aim-line);border-radius:9px;background:var(--aim-layer);position:relative;flex:none}
.aimrule-top-tools .aimrule-btn{width:26px;height:26px;padding:0;border-color:transparent;background:transparent;color:var(--aim-muted);font-size:13px;border-radius:7px}
.aimrule-top-tools .aimrule-btn:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-top-tools .aimrule-btn:disabled{opacity:.35}
.aimrule-top-tools .aimrule-btn.aimrule-tool-pan{display:grid;place-items:center}
.aimrule-top-tools .aimrule-btn.aimrule-tool-add{background:var(--aim-action);color:var(--aim-action-ink);font-size:17px;font-weight:600}
.aimrule-top-tools .aimrule-btn.aimrule-tool-add:hover{background:var(--aim-action-hover);color:var(--aim-action-ink)}
.aimrule-top-tools .aimrule-btn[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:auto;padding:0 8px;font-size:11px;gap:4px}
.aimrule-module-wrap{position:relative;display:flex;align-items:center}
.aimrule-module-popover{position:absolute;right:0;top:calc(100% + 8px);width:min(540px, calc(100vw - 32px));max-height:440px;z-index:40;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:14px;box-shadow:0 20px 48px rgba(0,0,0,.32);display:flex;flex-direction:column;overflow:hidden}
.aimrule-module-popover-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--aim-line);font-size:12px}
.aimrule-module-popover-head b{font-weight:600;flex:none}
.aimrule-module-popover-hint{font-size:10.5px;color:var(--aim-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-popover-body{flex:1;min-height:0;display:flex;gap:6px;overflow:hidden;padding:6px}
.aimrule-module-list{flex:1;min-width:0;overflow:auto;padding-right:2px}
.aimrule-module-detail{width:214px;flex:none;min-height:0;overflow:auto;border-left:.5px solid var(--aim-line);padding:6px 8px 8px;background:color-mix(in srgb, var(--aim-base) 55%, transparent);border-radius:0 8px 8px 0}
.aimrule-module-group{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--aim-muted);padding:6px 8px 3px;font-weight:600}
.aimrule-module-group-meta{font-size:9px;color:var(--aim-muted);border:.5px solid var(--aim-line);border-radius:999px;padding:0 5px;line-height:14px}
.aimrule-module-current{font-size:9px;font-weight:600;color:var(--aim-accent);background:var(--aim-accent-soft);border-radius:4px;padding:0 4px;line-height:14px}
.aimrule-module-pick{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;min-width:0}
.aimrule-module-pick:hover,.aimrule-module-pick[data-active=true]{background:var(--aim-hover)}
.aimrule-module-pick[data-active=true]{box-shadow:inset 2px 0 0 var(--aim-accent)}
.aimrule-module-pick:focus-visible{outline:2px solid var(--aim-accent);outline-offset:-1px}
.aimrule-module-pick .aimrule-module-info b{font-size:12px}
.aimrule-module-pick .aimrule-module-info span{font-size:10.5px}
.aimrule-module-summary{display:block;font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.aimrule-module-add{flex:none;color:var(--aim-muted);font-size:14px;width:20px;text-align:center}
.aimrule-module-pick:hover .aimrule-module-add{color:var(--aim-text)}
.aimrule-module-popover-foot{display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:.5px solid var(--aim-line)}
.aimrule-module-popover-foot .aimrule-btn{height:26px;font-size:11px}
.aimrule-module-detail-head{display:flex;flex-direction:column;gap:2px;padding:2px 2px 8px;border-bottom:.5px solid var(--aim-line);margin-bottom:6px}
.aimrule-module-detail-head b{font-size:12px;font-weight:600;color:var(--aim-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-head span{font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-list{display:flex;flex-direction:column;gap:2px}
.aimrule-module-detail-node{display:flex;align-items:flex-start;gap:6px;padding:4px 2px;min-width:0}
.aimrule-module-detail-glyph{flex:none;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;font-size:8.5px;background:color-mix(in srgb, currentColor 12%, transparent);margin-top:1px}
.aimrule-module-detail-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-module-detail-text b{font-size:11px;font-weight:500;color:var(--aim-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-text span{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:9.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-hint{margin:8px 2px 0;font-size:10px;line-height:1.5;color:var(--aim-muted)}
@media (max-width:720px){.aimrule-module-detail{display:none}.aimrule-module-popover{width:94vw}}
.aimrule-tool-more-wrap{display:none;position:relative;align-items:center}
.aimrule-tools-menu{position:absolute;right:0;top:calc(100% + 8px);width:190px;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-tools-menu-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--aim-muted);padding:5px 8px 7px;font-weight:600}
.aimrule-tools-menu .aimrule-flow-option{min-height:30px}
.aimrule-tools-menu .aimrule-flow-option-meta{margin-left:auto;font-size:10px;color:var(--aim-muted)}
@container (max-width: 1060px){
  .aimrule-tool-secondary,.aimrule-tool-secondary-sep{display:none !important}
  .aimrule-tool-more-wrap{display:flex}
}
@media (max-width: 1060px){
  .aimrule-tool-secondary,.aimrule-tool-secondary-sep{display:none !important}
  .aimrule-tool-more-wrap{display:flex}
}
@container (max-width: 760px){
  .aimrule-tool-modules-label{display:none}
  .aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:26px;padding:0;justify-content:center}
  .aimrule-sync-label{display:none}
  .aimrule-workspace-name{max-width:100px}
  .aimrule-title{max-width:120px}
}
@media (max-width: 760px){
  .aimrule-tool-modules-label{display:none}
  .aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:26px;padding:0;justify-content:center}
  .aimrule-sync-label{display:none}
  .aimrule-workspace-name{max-width:100px}
  .aimrule-title{max-width:120px}
}
.aimrule-more-wrap{position:relative;display:flex}
.aimrule-spacer{flex:1;min-width:8px}
.aimrule-btn{font:inherit;font-size:12px;height:28px;padding:0 10px;border-radius:8px;border:.5px solid var(--aim-line);background:var(--aim-layer);color:var(--aim-text);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;transition:background .12s,border-color .12s,color .12s}
.aimrule-btn:hover{background:var(--aim-raised);border-color:var(--aim-line-strong)}
.aimrule-btn:disabled{opacity:.45;cursor:default}
.aimrule-btn[data-active=true]{border-color:var(--aim-accent);color:var(--aim-accent);background:var(--aim-accent-soft)}
.aimrule-btn[data-kind=primary]{background:var(--aim-action);border-color:var(--aim-action);color:var(--aim-action-ink);font-weight:600}
.aimrule-btn[data-kind=primary]:hover{background:var(--aim-action-hover);border-color:var(--aim-action-hover)}
.aimrule-btn[data-kind=primary]:disabled{opacity:.5}
.aimrule-btn[data-kind=ghost]{background:transparent;border-color:transparent;color:var(--aim-muted)}
.aimrule-btn[data-kind=ghost]:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-btn[data-kind=danger]{color:var(--aim-danger)}
.aimrule-btn[data-kind=danger]:hover{background:color-mix(in srgb, var(--aim-danger) 10%, transparent)}
.aimrule-group{display:flex;align-items:center;gap:4px}
.aimrule-select{font:inherit;font-size:12px;color:var(--aim-text);background:var(--aim-layer);border:.5px solid var(--aim-line);border-radius:8px;padding:5px 8px;outline:none}
.aimrule-select:focus{border-color:var(--aim-accent)}
.aimrule-workspace{position:relative;display:flex;flex:none}
.aimrule-workspace-trigger{gap:6px;color:var(--aim-muted);max-width:230px}
.aimrule-workspace-trigger:hover{color:var(--aim-text)}
.aimrule-workspace-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}
.aimrule-workspace-menu{left:0;top:calc(100% + 8px);width:260px}
.aimrule-flow-menu{position:absolute;left:0;top:calc(100% + 8px);width:252px;max-height:min(420px,70vh);overflow:auto;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-flow-menu.aimrule-more-menu{left:auto;right:0;width:200px;max-height:none}
.aimrule-flow-mask{position:fixed;inset:0;z-index:30}
.aimrule-flow-option{font:inherit;font-size:12px;text-align:left;border:0;background:transparent;color:var(--aim-text);border-radius:8px;padding:7px 9px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%}
.aimrule-flow-option:hover{background:var(--aim-hover)}
.aimrule-flow-option[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-flow-option[data-danger=true]{color:var(--aim-danger)}
.aimrule-flow-option:disabled{opacity:.45;cursor:default}
.aimrule-flow-option-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-flow-option-meta{flex:none;font-size:10px;color:var(--aim-muted)}
.aimrule-flow-menu-sep{height:1px;background:var(--aim-line);margin:4px 2px}
.aimrule-module-row{display:flex;align-items:center;gap:12px;border:.5px solid var(--aim-line);border-radius:10px;padding:10px 12px;background:var(--aim-base)}
.aimrule-module-row[draggable=true]{cursor:grab}
.aimrule-module-row[draggable=true]:active{cursor:grabbing}
.aimrule-module-grip{flex:none;color:var(--aim-muted);font-size:11px;letter-spacing:-2px;cursor:grab;user-select:none}
.aimrule-overlay[data-dragging=true]{pointer-events:none;background:transparent;backdrop-filter:none}
.aimrule-overlay[data-dragging=true] .aimrule-modal{opacity:0;transform:scale(.985);pointer-events:none;transition:opacity .1s,transform .1s}
.aimrule-module-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.aimrule-module-info b{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-info span{font-size:11px;color:var(--aim-muted)}
.aimrule-detect{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:.5px solid var(--aim-line);border-radius:12px;background:var(--aim-base)}
.aimrule-candidates{display:flex;flex-direction:column;gap:8px}
.aimrule-candidate{border:.5px solid var(--aim-line-strong);border-radius:12px;padding:10px 12px;background:var(--aim-base);display:flex;flex-direction:column;gap:6px}
.aimrule-candidate-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.aimrule-candidate-head b{font-size:12.5px}
.aimrule-candidate-head span{font-size:11px;color:var(--aim-muted)}
.aimrule-candidate-occ{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--aim-muted);flex-wrap:wrap}
.aimrule-candidate-occ .aimrule-btn{height:26px;font-size:11px;margin-left:auto}
.aimrule-modal-sep{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--aim-muted);margin-top:2px}
.aimrule-modal-sep::before,.aimrule-modal-sep::after{content:"";height:1px;background:var(--aim-line);flex:1}
.aimrule-source{border:.5px solid var(--aim-line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--aim-base)}
.aimrule-source-head{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--aim-muted);flex-wrap:wrap}
.aimrule-source-head b{font-size:12px;color:var(--aim-text);font-weight:600}
.aimrule-source-head .aimrule-btn{height:24px;padding:0 7px;font-size:11px;border-color:transparent;background:transparent;color:var(--aim-muted)}
.aimrule-source-head .aimrule-btn:hover{color:var(--aim-text);background:var(--aim-hover)}
.aimrule-convo-list{max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:2px;border-top:.5px solid var(--aim-line);padding-top:6px}
.aimrule-convo-item{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:8px;cursor:pointer;min-width:0}
.aimrule-convo-item:hover{background:var(--aim-hover)}
.aimrule-convo-item input{margin:2px 0 0;flex:none}
.aimrule-role{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--aim-accent-soft);color:var(--aim-accent);font-weight:600}
.aimrule-role[data-role=assistant]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);color:var(--dsw-alias-state-success-primary)}
.aimrule-convo-text{flex:1;min-width:0;font-size:11.5px;line-height:1.5;color:var(--aim-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aimrule-convo-time{flex:none;font-size:10px;color:var(--aim-muted);opacity:.7;padding-top:1px}
.aimrule-file-list{display:flex;flex-wrap:wrap;gap:6px}
.aimrule-file-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;border:.5px solid var(--aim-line);border-radius:999px;padding:3px 6px 3px 10px;max-width:100%;color:var(--aim-muted);background:var(--aim-layer)}
.aimrule-file-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.aimrule-file-chip button{border:0;background:transparent;color:var(--aim-muted);cursor:pointer;padding:0 2px;font-size:12px;line-height:1}
.aimrule-file-chip button:hover{color:var(--aim-danger)}
.aimrule-notes{flex:none;display:flex;align-items:center;gap:10px;padding:7px 14px;background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent);font-size:11px;color:var(--aim-text);overflow:hidden}
.aimrule-notes b{flex:none;color:var(--dsw-alias-state-warn-primary);font-weight:600}
.aimrule-note{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--aim-muted)}
.aimrule-body{flex:1;min-height:0;display:flex;position:relative;background:var(--aim-base)}
.aimrule-stage{position:relative;flex:1;min-width:0;overflow:hidden;cursor:default;background-color:var(--aim-base);background-image:radial-gradient(var(--aimrule-grid) 1px, transparent 1px);background-size:24px 24px}
.aimrule-stage::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(620px 320px at 50% 0%, color-mix(in srgb, var(--aim-accent) 7%, transparent), transparent 72%)}
.aimrule-stage[data-tool=hand]{cursor:grab}
.aimrule-stage[data-panning=true]{cursor:grabbing}
.aimrule-stage[data-marquee=true]{cursor:crosshair}
.aimrule-canvas-bar .aimrule-btn[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-select{width:auto;padding:0 9px;font-size:11px;gap:4px}
.aimrule-composer,.aimrule-dock,.aimrule-toast,.aimrule-notes,.aimrule-canvas-bar,.aimrule-zoom,.aimrule-canvas-menu{cursor:default}
.aimrule-composer-input,.aimrule-dock-input,.aimrule-input{cursor:text}
.aimrule-world{position:absolute;left:0;top:0;transform-origin:0 0}
.aimrule-edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.aimrule-edge-hit{pointer-events:stroke;stroke:transparent;stroke-width:14;fill:none;cursor:pointer}
.aimrule-edge{fill:none;stroke:var(--aimrule-edge);stroke-width:1.6}
.aimrule-edge[data-selected=true]{stroke:var(--aim-accent);stroke-width:2.4}
.aimrule-edge-label{font-size:11px;fill:var(--aim-muted);paint-order:stroke;stroke:var(--aim-base);stroke-width:4px;stroke-linejoin:round;pointer-events:none}
.aimrule-node{position:absolute;width:${NODE_W}px;height:${NODE_H}px;border-radius:12px;border:.5px solid var(--aim-line);background:var(--aim-layer);
  box-shadow:0 1px 2px rgba(0,0,0,.12);padding:11px 12px;display:flex;flex-direction:column;gap:3px;cursor:grab;user-select:none;overflow:hidden;transition:box-shadow .12s,border-color .12s}
.aimrule-node::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;border-radius:0 2px 2px 0;background:var(--node-accent,var(--aim-accent));opacity:.72;pointer-events:none}
.aimrule-node[data-type=start]{--node-accent:var(--aimrule-start)}
.aimrule-node[data-type=judge]{--node-accent:var(--aimrule-judge)}
.aimrule-node[data-type=calc]{--node-accent:var(--aimrule-calc)}
.aimrule-node[data-type=action]{--node-accent:var(--aimrule-action)}
.aimrule-node[data-type=end]{--node-accent:var(--aimrule-end)}
.aimrule-node[data-type=module]{--node-accent:var(--aimrule-module)}
.aimrule-node:hover{border-color:var(--aim-line-strong);box-shadow:0 8px 22px rgba(0,0,0,.16)}
.aimrule-node[data-selected=true]{border-color:color-mix(in srgb, var(--aim-accent) 70%, var(--aim-line-strong));box-shadow:0 0 0 2px color-mix(in srgb, var(--aim-accent) 22%, transparent),0 8px 22px rgba(0,0,0,.16)}
.aimrule-node[data-connect-target=true]{border-color:var(--aim-accent);box-shadow:0 0 0 2px var(--aim-accent-soft),0 10px 26px rgba(0,0,0,.20)}
.aimrule-node[data-module=true]{background:color-mix(in srgb, var(--aim-module) 4%, var(--aim-layer));border-style:dashed}
.aimrule-node-head{display:flex;align-items:center;gap:8px;min-width:0}
.aimrule-node-glyph{flex:none;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:10px;line-height:1;color:var(--node-color,var(--aim-accent));background:color-mix(in srgb, var(--node-color,var(--aim-accent)) 12%, transparent)}
.aimrule-node-title{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.aimrule-node-badge{flex:none;font-size:10px;color:var(--aim-muted);background:var(--aim-base);border:.5px solid var(--aim-line);border-radius:6px;padding:0 5px}
.aimrule-node-line{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-node-line b{color:var(--aim-text);font-weight:500}
.aimrule-node-src{font-size:10px;color:color-mix(in srgb, var(--aim-muted) 82%, transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:auto}
.aimrule-handle{position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--aim-base);border:1.5px solid var(--aim-line-strong);cursor:crosshair;opacity:0;transition:opacity .12s}
.aimrule-handle::before{content:"";position:absolute;inset:-6px;border-radius:50%}
.aimrule-node:hover .aimrule-handle,.aimrule-node[data-selected=true] .aimrule-handle{opacity:1}
.aimrule-node[data-connect-target=true] .aimrule-handle[data-side=in]{opacity:1;border-color:var(--aim-accent);background:var(--aim-accent)}
.aimrule-handle[data-side=in]{left:-6px}
.aimrule-handle[data-side=out]{right:-6px}
.aimrule-handle:hover{border-color:var(--aim-accent);background:var(--aim-accent)}
.aimrule-marquee{position:absolute;border:1px solid var(--aim-accent);background:color-mix(in srgb, var(--aim-accent) 12%, transparent);pointer-events:none;border-radius:2px}
.aimrule-canvas-bar{position:absolute;left:14px;top:14px;z-index:6;display:flex;align-items:center;gap:2px;padding:4px;border:.5px solid var(--aim-line);border-radius:12px;background:color-mix(in srgb, var(--aim-layer) 80%, transparent);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.12);opacity:.75;transition:opacity .16s}
.aimrule-canvas-bar:hover,.aimrule-canvas-bar:focus-within{opacity:1}
.aimrule-canvas-bar .aimrule-btn{width:30px;height:30px;padding:0;justify-content:center;border-color:transparent;background:transparent;color:var(--aim-muted);font-size:13px}
.aimrule-canvas-bar .aimrule-btn:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-canvas-bar .aimrule-btn:disabled{opacity:.35}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-add{background:var(--aim-action);color:var(--aim-action-ink);font-size:18px;font-weight:600}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-add:hover{background:var(--aim-action-hover);color:var(--aim-action-ink)}
.aimrule-bar-sep{width:1px;height:16px;background:var(--aim-line);margin:0 3px}
.aimrule-add-menu{position:absolute;left:0;top:calc(100% + 8px);width:236px;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-add-menu-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--aim-muted);padding:5px 8px 7px;font-weight:600}
.aimrule-add-item{display:flex;align-items:center;gap:9px;width:100%;padding:8px;border:0;border-radius:8px;background:transparent;color:var(--aim-text);text-align:left;cursor:pointer;font:inherit}
.aimrule-add-item:hover{background:var(--aim-hover)}
.aimrule-add-item-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-add-item-text b{font-size:12px;font-weight:600}
.aimrule-add-item-text span{font-size:10.5px;color:var(--aim-muted)}
.aimrule-canvas-menu{position:absolute;z-index:33;width:214px;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-canvas-menu-title{padding:5px 8px 3px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--aim-muted)}
.aimrule-canvas-menu .aimrule-add-item{padding:6px 8px;gap:8px;font-size:12px}
.aimrule-canvas-menu .aimrule-add-item:disabled{opacity:.4;cursor:default}
.aimrule-add-item[data-danger=true]{color:var(--aim-danger)}
.aimrule-canvas-menu-meta{margin-left:auto;font-size:10px;color:var(--aim-muted)}
.aimrule-new-flow-menu{width:100%;height:32px;margin-top:2px;font-weight:600}

.aimrule-dot{width:7px;height:7px;border-radius:2px;flex:none;background:var(--aim-muted)}
.aimrule-zoom{position:absolute;right:14px;bottom:14px;display:flex;align-items:center;gap:2px;z-index:6;padding:4px;border-radius:12px;border:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-layer) 80%, transparent);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.10)}
.aimrule-zoom .aimrule-btn{width:28px;height:28px;padding:0;border-color:transparent;background:transparent;color:var(--aim-muted)}
.aimrule-zoom .aimrule-btn:hover{color:var(--aim-text);background:var(--aim-hover)}
.aimrule-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none}
.aimrule-onboard{pointer-events:auto;width:min(620px,100%);display:flex;flex-direction:column;gap:14px;padding:24px 26px 22px;border-radius:16px;border:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-layer) 90%, transparent);backdrop-filter:blur(14px);box-shadow:0 24px 60px rgba(0,0,0,.20)}
.aimrule-onboard[data-size=sm]{width:min(480px,100%);padding:20px 22px;gap:10px}
.aimrule-onboard[data-size=sm] h2{font-size:16px}
.aimrule-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--aim-accent)}
.aimrule-onboard h2{margin:0;font-size:22px;line-height:1.32;font-weight:650;letter-spacing:-.01em}
.aimrule-onboard p{margin:0;font-size:12.5px;line-height:1.7;color:var(--aim-muted)}
.aimrule-onboard .aimrule-textarea{min-height:112px;font-size:13px;line-height:1.6;background:var(--aim-base);border-radius:10px;padding:10px 12px}
.aimrule-onboard-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aimrule-onboard-hint{font-size:11px;color:var(--aim-muted)}
.aimrule-steps{display:flex;gap:16px;flex-wrap:wrap}
.aimrule-step{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--aim-muted)}
.aimrule-step-num{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:var(--aim-accent-soft);color:var(--aim-accent);font-size:10px;font-weight:700}
.aimrule-kinds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.aimrule-kind{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--aim-muted);border:.5px solid var(--aim-line);border-radius:999px;padding:3px 9px}
.aimrule-hero{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 24px 180px;text-align:center;pointer-events:none}
.aimrule-hero .aimrule-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--aim-accent)}
.aimrule-hero h2{margin:0;font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-.01em;color:var(--aim-text)}
.aimrule-hero p{margin:0;max-width:540px;font-size:12.5px;line-height:1.7;color:var(--aim-muted)}
.aimrule-hero-link{pointer-events:auto;border:0;background:transparent;color:var(--aim-accent);font:inherit;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:8px}
.aimrule-hero-link:hover{background:var(--aim-hover)}
.aimrule-composer{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);z-index:16;width:min(760px, calc(100% - 80px));display:flex;flex-direction:column;gap:6px}
.aimrule-composer-chips{display:flex;flex-wrap:wrap;gap:4px;max-height:76px;overflow:auto;padding:0 4px}
.aimrule-composer-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--aim-muted);background:color-mix(in srgb, var(--aim-layer) 88%, transparent);border:.5px solid var(--aim-line);border-radius:999px;padding:3px 6px 3px 9px;max-width:280px;white-space:nowrap}
.aimrule-composer-chip button{border:0;background:transparent;color:var(--aim-muted);cursor:pointer;font-size:10px;padding:0 2px;line-height:1}
.aimrule-composer-chip button:hover{color:var(--aim-danger)}
.aimrule-composer-box{display:flex;align-items:flex-end;gap:6px;padding:7px;background:color-mix(in srgb, var(--aim-layer) 94%, transparent);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.28);backdrop-filter:blur(16px)}
.aimrule-composer-add{width:30px;height:30px;flex:none;border:0;border-radius:50%;background:transparent;color:var(--aim-muted);font-size:18px;cursor:pointer;display:grid;place-items:center}
.aimrule-composer-add:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-composer-input{flex:1;min-width:0;border:0;background:transparent;color:var(--aim-text);font:inherit;font-size:13px;line-height:1.6;padding:9px 2px;outline:none;resize:none;field-sizing:content;min-height:54px;max-height:180px;overflow-y:auto}
.aimrule-composer-input::placeholder{color:var(--aim-muted)}
.aimrule-composer-send{width:30px;height:30px;flex:none;border:0;border-radius:50%;background:var(--aim-action);color:var(--aim-action-ink);font-size:15px;font-weight:600;cursor:pointer;display:grid;place-items:center}
.aimrule-composer-send:hover{background:var(--aim-action-hover)}
.aimrule-composer-send:disabled{opacity:.35;cursor:default}
.aimrule-composer-foot{display:flex;align-items:center;gap:8px;padding:0 6px;font-size:11px;color:var(--aim-muted)}
.aimrule-composer-hint{font-size:11px;color:var(--aim-muted)}
.aimrule-composer-menu{position:absolute;left:0;bottom:calc(100% + 8px);width:230px;z-index:18;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-composer-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--aim-text);text-align:left;cursor:pointer;font:inherit;font-size:12px}
.aimrule-composer-menu-item:hover{background:var(--aim-hover)}
.aimrule-menu-glyph{width:14px;text-align:center;color:var(--aim-muted);font-size:12px;flex:none}
.aimrule-composer-picker{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);width:min(560px,100%);max-height:420px;z-index:18;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 18px 44px rgba(0,0,0,.30);display:flex;flex-direction:column;overflow:hidden}
.aimrule-picker-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--aim-line);font-size:12px}
.aimrule-picker-head b{flex:1;font-weight:600}
.aimrule-picker-body{padding:8px 12px;display:flex;flex-direction:column;gap:6px;min-height:0;overflow:auto}
.aimrule-picker-list{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow:auto}
.aimrule-picker-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px;font-size:11.5px;color:var(--aim-muted);cursor:pointer;min-width:0}
.aimrule-picker-row:hover{background:var(--aim-hover)}
.aimrule-picker-row input{flex:none}
.aimrule-picker-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--aim-text)}
.aimrule-picker-meta{flex:none;font-size:10px;color:var(--aim-muted)}
.aimrule-picker-row-chat{align-items:flex-start}
.aimrule-file-tree{display:flex;flex-direction:column;gap:1px}
.aimrule-tree-group{display:flex;flex-direction:column;gap:1px}
.aimrule-tree-row{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:7px;font-size:11.5px;color:var(--aim-muted);cursor:pointer;min-width:0}
.aimrule-tree-row:hover{background:var(--aim-hover)}
.aimrule-tree-row input{flex:none}
.aimrule-tree-toggle{width:16px;height:16px;flex:none;border:0;background:transparent;color:var(--aim-muted);font-size:9px;cursor:pointer;display:grid;place-items:center;padding:0;border-radius:4px}
.aimrule-tree-toggle:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-tree-children{display:flex;flex-direction:column;gap:1px}
.aimrule-picker-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:.5px solid var(--aim-line)}
.aimrule-picker-foot .aimrule-btn{height:26px;font-size:11px}
.aimrule-composer-mask{position:fixed;inset:0;z-index:15}
.aimrule-panel-section{padding:14px 16px;border-bottom:.5px solid var(--aim-line);display:flex;flex-direction:column;gap:11px}
.aimrule-panel-section:last-child{border-bottom:none}
.aimrule-panel-section h3{font-size:11px;letter-spacing:.02em;color:var(--aim-muted);margin:0;font-weight:600}
.aimrule-inspector{width:336px;flex:none;border-left:.5px solid var(--aim-line);background:var(--aim-base);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.aimrule-inspector-head{flex:none;display:flex;align-items:center;gap:8px;height:50px;padding:0 14px;border-bottom:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-base) 94%, transparent);backdrop-filter:blur(12px)}
.aimrule-inspector-head h3{font-size:13px;font-weight:600;margin:0;flex:1}
.aimrule-inspector-glyph{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:600}
.aimrule-inspector-title{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.aimrule-inspector-title h3{flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.aimrule-inspector-sub{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-inspector-body{flex:1;min-height:0;overflow:auto}
.aimrule-inspector-foot{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 14px;border-top:.5px solid var(--aim-line);background:var(--aim-base)}
.aimrule-inspector-foot .aimrule-btn{height:30px}
.aimrule-field{display:flex;flex-direction:column;gap:6px}
.aimrule-field-label{font-size:11.5px;color:var(--aim-muted)}
.aimrule-input,.aimrule-textarea,.aimrule-select{font:inherit;font-size:12.5px;width:100%;height:32px;color:var(--aim-text);background:var(--aim-layer);border:.5px solid var(--aim-line);border-radius:8px;padding:0 10px;outline:none;transition:border-color .12s,box-shadow .12s}
.aimrule-input:focus,.aimrule-textarea:focus,.aimrule-select:focus{border-color:var(--aim-accent);box-shadow:0 0 0 2px color-mix(in srgb, var(--aim-accent) 14%, transparent)}
.aimrule-textarea{height:auto;min-height:68px;padding:8px 10px;line-height:1.5}
.aimrule-select{appearance:none;padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,var(--aim-muted) 50%),linear-gradient(135deg,var(--aim-muted) 50%,transparent 50%);background-position:calc(100% - 14px) calc(50% - 1px),calc(100% - 9px) calc(50% - 1px);background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.aimrule-edge-path{margin-top:2px;font-size:11px;color:var(--aim-muted);line-height:1.6;word-break:break-word}
.aimrule-selection-list{display:flex;flex-direction:column;gap:1px;max-height:220px;overflow:auto}
.aimrule-selection-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;font-size:11.5px;color:var(--aim-text)}
.aimrule-selection-row:hover{background:var(--aim-hover)}
.aimrule-selection-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-input:focus,.aimrule-textarea:focus,.aimrule-select:focus{border-color:var(--aim-accent)}
.aimrule-textarea{resize:vertical;min-height:52px;line-height:1.45}
.aimrule-muted{color:var(--aim-muted);font-size:11px;line-height:1.6}
.aimrule-hint{font-size:11px;color:var(--aim-muted);line-height:1.65}
.aimrule-divider{height:1px;background:var(--aim-line);margin:2px 0}
.aimrule-source{border:.5px solid var(--aim-line);border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:2px;background:var(--aim-layer)}
.aimrule-source b{font-size:11px;font-weight:600}
.aimrule-source span{font-size:10px;color:var(--aim-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aimrule-dock{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);z-index:14;display:flex;align-items:center;gap:6px;padding:6px;border:.5px solid var(--aim-line-strong);border-radius:16px;background:color-mix(in srgb, var(--aim-layer) 92%, transparent);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.28);width:min(660px, calc(100% - 40px));flex-wrap:wrap}
.aimrule-dock-count{font-size:11px;font-weight:600;color:var(--aim-muted);white-space:nowrap;padding-left:6px}
.aimrule-dock-input{flex:1;min-width:180px;font:inherit;font-size:12px;height:32px;border-radius:8px;border:.5px solid var(--aim-line);background:var(--aim-base);color:var(--aim-text);padding:0 11px;outline:none}
.aimrule-dock-input:focus{border-color:var(--aim-accent)}
.aimrule-overlay{position:absolute;inset:0;background:color-mix(in srgb, #000 42%, transparent);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:20;padding:24px}
.aimrule-modal{width:min(780px,100%);max-height:min(680px,92%);background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
.aimrule-modal-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:.5px solid var(--aim-line);flex:none}
.aimrule-modal-head h2{font-size:14px;margin:0;font-weight:600;flex:1}
.aimrule-modal-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px;min-height:0}
.aimrule-modal-foot{padding:12px 18px;border-top:.5px solid var(--aim-line);display:flex;align-items:center;gap:8px;justify-content:flex-end;flex:none}
.aimrule-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--aim-line);padding:0 12px;flex:none}
.aimrule-tab{font:inherit;font-size:12px;border:0;background:transparent;color:var(--aim-muted);padding:9px 10px;cursor:pointer;border-bottom:2px solid transparent}
.aimrule-tab[data-active=true]{color:var(--aim-text);border-bottom-color:var(--aim-accent);font-weight:600}
.aimrule-pre{margin:0;padding:12px 14px;border-radius:10px;background:var(--aim-base);border:.5px solid var(--aim-line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow:auto;flex:1;min-height:0}
.aimrule-error{font-size:12px;color:var(--aim-danger);background:color-mix(in srgb, var(--aim-danger) 10%, transparent);border:.5px solid color-mix(in srgb, var(--aim-danger) 30%, transparent);border-radius:8px;padding:8px 10px;white-space:pre-wrap;max-height:180px;overflow:auto}
.aimrule-toast{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:30;background:var(--aim-raised);border:.5px solid var(--aim-line-strong);box-shadow:0 12px 32px rgba(0,0,0,.24);border-radius:10px;padding:8px 14px;font-size:12px;color:var(--aim-text);max-width:80%}
.aimrule-toast[data-tone=error]{color:var(--aim-danger)}
.aimrule-tpl{display:flex;align-items:center;gap:10px;border:.5px solid var(--aim-line);border-radius:12px;padding:9px 11px;background:var(--aim-layer)}
.aimrule-tpl-info{flex:1;min-width:0}
.aimrule-tpl-info b{display:block;font-size:12px}
.aimrule-tpl-info span{font-size:10px;color:var(--aim-muted)}
.aimrule-badge{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:6px;border:.5px solid var(--aim-line-strong);color:var(--aim-muted)}
.aimrule-badge[data-status=pass]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)}
.aimrule-badge[data-status=fail],.aimrule-badge[data-status=error]{color:var(--aim-danger);border-color:color-mix(in srgb, var(--aim-danger) 45%, transparent);background:color-mix(in srgb, var(--aim-danger) 10%, transparent)}
.aimrule-badge[data-status=inconclusive]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent)}
.aimrule-case{border:.5px solid var(--aim-line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--aim-base)}
.aimrule-case-head{display:flex;align-items:center;gap:8px}
.aimrule-ai-append{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--aim-muted);cursor:pointer;padding:0 4px;white-space:nowrap}
.aimrule-ai-append input{accent-color:var(--aim-accent)}
.aimrule-case-delete{width:28px;padding:0;flex:none;color:var(--aim-muted)}
.aimrule-case-delete:hover{color:var(--aim-danger)}
.aimrule-case-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.aimrule-case-result{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--aim-muted)}
.aimrule-mismatch{color:var(--aim-danger);font-family:ui-monospace,Menlo,monospace}
.aimrule-overview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.aimrule-stat{border:.5px solid var(--aim-line);border-radius:12px;padding:12px 14px;background:var(--aim-base)}
.aimrule-stat b{display:block;font-size:22px;font-weight:650;line-height:1.2}
.aimrule-stat span{font-size:11px;color:var(--aim-muted)}
.aimrule-legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.aimrule-legend-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--aim-muted)}
.aimrule-legend-dot{width:8px;height:8px;border-radius:2px;flex:none}
.aimrule-shortcuts{display:flex;flex-direction:column;gap:7px;font-size:11.5px;color:var(--aim-muted)}
.aimrule-kbd{font-family:ui-monospace,Menlo,monospace;font-size:10px;padding:1px 5px;border:.5px solid var(--aim-line);border-bottom-width:2px;border-radius:4px;background:var(--aim-base);color:var(--aim-text)}
.aimrule-loading{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--aim-muted);font-size:13px}
@media (width<=760px){.aimrule-title{width:120px}.aimrule-project{max-width:120px}}

/* ------------------------------------------------------ composer launcher */

.aimrule-launcher-root{display:contents}
.aimrule-launch-button{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:transparent !important;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;flex:none;box-shadow:none !important}
.aimrule-launch-button:hover,.aimrule-launch-button:active,.aimrule-launch-button:focus{background:transparent !important;border-color:transparent !important;box-shadow:none !important}
.aimrule-launch-button:hover{color:var(--dsw-alias-label-primary)}
.aimrule-launch-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.aimrule-launcher-mask{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.46);backdrop-filter:blur(3px)}
.aimrule-launcher{width:min(1240px,94vw);height:min(900px,88vh);display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.46)}
.aimrule-launcher-head{flex:none;height:44px;display:flex;align-items:center;gap:10px;padding:0 8px 0 14px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.aimrule-launcher-mark{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);flex:none}
.aimrule-launcher-heading{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-launcher-heading b{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.25}
.aimrule-launcher-heading span{font-size:10.5px;color:var(--dsw-alias-label-secondary);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aimrule-launcher-spacer{flex:1}
.aimrule-launcher-close{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;padding:0}
.aimrule-launcher-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.aimrule-launcher-body{flex:1;min-height:0;display:flex;overflow:hidden}
.aimrule-launcher-body > .aimrule-root{flex:1;min-width:0;min-height:0}
@media (max-width:720px){.aimrule-launcher-mask{padding:8px}.aimrule-launcher{width:96vw;height:94vh}}

.aimrule-btn:focus-visible,.aimrule-flow-option:focus-visible,.aimrule-tree-row:focus-visible,.aimrule-crumb:focus-visible,.aimrule-module-pick:focus-visible,.aimrule-module-add:focus-visible{outline:2px solid var(--aim-accent);outline-offset:1px}
.aimrule-field input:focus-visible,.aimrule-field textarea:focus-visible,.aimrule-field select:focus-visible,.aimrule-composer-input:focus-visible,.aimrule-run-input:focus-visible,.aimrule-run-expect:focus-visible{border-color:var(--aim-accent);box-shadow:0 0 0 2px var(--aim-accent-soft);outline:none}

`


