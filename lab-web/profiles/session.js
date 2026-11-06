// Runtime bindings are immutable for a page lifetime. Switching reloads the UI.
export const profileSession={profile:null,manager:null};
export const storageNames=()=>profileSession.profile||{id:'legacy-local',webDB:'nexo-web-v1',researchDB:'nexo-research-v3'};
