// Brand palette, mirrored from frontend/src/index.css (:root) and
// mobile/tailwind.config.js.
//
// Prefer NativeWind classes (`bg-navy`, `text-gold-deep`) in screens. Use these
// JS constants only where a class can't reach: navigation options, StatusBar,
// icon `color` props, ActivityIndicator, and other native component props.
export const colors = {
  navy: "#1B2B4A",
  navyDeep: "#14213D",
  navySoft: "#233A63",

  gold: "#C8A951",
  goldLight: "#E8C96A",
  goldDeep: "#A9863A",

  cream: "#FAF6EC",
  creamWarm: "#F3ECD9",

  slate: "#4A5568",
  slateLight: "#7A8699",

  ink: "#1B2B4A",
  heroCream: "#F5EEC9",
};

export default colors;
