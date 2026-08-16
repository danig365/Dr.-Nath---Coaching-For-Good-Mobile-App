# Page conversion prompt

Hand this to the AI **together with one** `frontend/src/pages/<Page>.jsx` file.
Convert one page per request — batching produces worse output.

Fill in the two blanks at the top (`PAGE NAME`, `TARGET PATH`) and paste the web
file underneath. Everything below the line is the prompt.

Target paths follow expo-router: `app/(client)/sessions.jsx` becomes the route
`/sessions`. Ask me if you're unsure where a page belongs.

---

You are converting a page from a React **web** app to a React Native **mobile**
app. Both talk to the same Django backend. Convert only the page I give you.

**Page:** `PAGE NAME`
**Write it to:** `TARGET PATH`

## Non-negotiable rules

1. Output **one complete file**, nothing else. No explanation before or after,
   no "here's what I changed", no partial snippets with `// ...rest unchanged`.
2. **JavaScript, not TypeScript.** No type annotations, no `.tsx`.
3. **Preserve all business logic exactly** — API endpoints, request bodies, state
   shape, conditionals, date maths, permission checks. If the web page calls
   `api.get("/bookings/123/reflection/")`, the mobile page calls the identical
   URL. Do not "improve", rename, or reorganise logic. Layout and presentation
   are what change; behaviour is not.
4. If something genuinely has no mobile equivalent, keep it working in the
   simplest way and mark it `// TODO(mobile):` with one line saying why. Never
   silently drop a feature.

## The stack you are writing for

- Expo SDK 57, React Native 0.86, React 19
- `expo-router` for navigation (file-based)
- **NativeWind 4** — Tailwind `className` works on React Native components.
  Keep the existing Tailwind classes wherever they are valid (see limits below).
- Import alias: **`@/` maps to `mobile/src/`**. Always use it — never write
  `../../src/...`.

## Element mapping

| Web | React Native |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>`, `<h1>`–`<h6>`, `<label>`, raw text | `<Text>` |
| `<button>` | `<Pressable>` (or `<Button>` from `@/components/ui`) |
| `<input>` | `<TextInput>` |
| `<textarea>` | `<TextInput multiline>` |
| `<img>` | `<Image>` from `expo-image` |
| `<a href>` | `<Link href>` from `expo-router`, or `Linking.openURL` for external |
| `<select>` | `<Picker>` from `@react-native-picker/picker` |
| scrollable page body | `<ScrollView>` |
| long/dynamic list | `<FlatList>` |
| `<form>` | plain `<View>` + a submit `<Pressable>` |

**All text must be inside `<Text>`.** A bare string inside `<View>` crashes at
runtime. This is the single most common conversion error — check every line.

## Import mapping

| Web import | Mobile replacement |
|---|---|
| `import { api } from "../utils/auth"` | `import { api } from "@/api/client"` |
| `import { useAuth } from "../context/AuthContext"` | `import { useAuth } from "@/context/AuthContext"` |
| `import { toast } from "react-toastify"` | `import { toast } from "@/lib/toast"` (same `toast.success/error/info` API) |
| `useNavigate()` from `react-router-dom` | `useRouter()` from `expo-router`; `navigate("/x")` → `router.push("/x")` |
| `useParams()` from `react-router-dom` | `useLocalSearchParams()` from `expo-router` |
| `<Link to="/x">` | `<Link href="/x">` from `expo-router` |
| `react-icons/fi` (Feather) | `import Feather from "@expo/vector-icons/Feather"` — `<FiCalendar/>` → `<Feather name="calendar" size={20} color={colors.navy} />` (strip `Fi`, kebab-case the rest) |
| `@heroicons/react/24/outline` | `import Ionicons from "@expo/vector-icons/Ionicons"`, nearest matching name |
| `framer-motion` (`motion.div`, `AnimatePresence`) | Drop the animation. Use a plain `<View>` and keep the final/visible style. Do **not** pull in an animation library. |
| `localStorage` / `sessionStorage` | Never use. Auth tokens come from `useAuth()`; nothing else should be persisted without asking. |
| `window.*`, `document.*` | Do not exist. Remove, or replace with the RN equivalent (`Dimensions`, `Platform`). |
| `new WebSocket(...)` with `window.location.host` | `import { chatSocket, groupChatSocket, groupCallSocket } from "@/api/socket"` — e.g. `const ws = await chatSocket(bookingId)`. These are async and refresh the token before connecting. |
| `<img src={someApiPath}>` | `import { mediaSource } from "@/api/media"` → `<Image source={mediaSource(path)} />`. Upload paths from the API are relative and **must** go through this. |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | `import { deviceTimezone } from "@/lib/timezone"`, or just use `timezone` from `useAuth()` |

## Use the existing primitives

Prefer these over hand-rolled markup — they already carry the brand styling:

```js
import { Screen, Card, Button, Input, Badge, EmptyState } from "@/components/ui";
```

- `<Screen>` — cream background, safe-area, scrolling, `loading` and `onRefresh` props. Use it as the screen root instead of a bare `ScrollView`.
- `<Button variant="gold|navy|outline|ghost" loading={...}>` — the pill buttons.
- `<Card onPress={...}>` — list rows and content blocks.
- `<Input label="..." error="..." />` — labelled text field.
- `<Badge tone="neutral|navy|gold|success|danger">` — status pills.
- `<EmptyState icon="inbox" title="..." message="..." />` — empty lists.

## Styling rules

Keep Tailwind classes. These **do not exist** in NativeWind — replace them:

- No `hover:`, `focus:`, `group-hover:` — use Pressable's `({ pressed })` style
  callback, or just drop the hover state.
- No `transition-*`, `duration-*`, `ease-*`, `animate-*` — drop them.
- No `cursor-*`, `select-none`, `overflow-x-*`, `backdrop-blur`, `z-[…]` beyond
  simple `z-10`.
- `space-x-*` / `space-y-*` are unreliable — use `gap-*` on a flex container.
- Shadows: `shadow-lg` etc. render inconsistently. Prefer a `border border-cream-warm`
  or leave it off.
- Everything is flexbox already; `flex-row` must be explicit (RN defaults to
  column, the web defaults to row).

### Brand colours — use these class names

`bg-navy` `bg-navy-deep` `bg-navy-soft` · `bg-gold` `bg-gold-light` `bg-gold-deep`
· `bg-cream` `bg-cream-warm` · `text-slate` `text-slate-light` `text-ink`

Same names work as `text-*` and `border-*`. If the web file uses a raw hex or a
CSS var (`#1B2B4A`, `var(--navy)`, `style={{ color: "#C8A951" }}`), replace it
with the matching class. **Never invent a colour that isn't in this list.**

For native props that can't take a class (icon `color`, `ActivityIndicator`,
`placeholderTextColor`), use `import { colors } from "@/theme/colors"` →
`colors.navy`, `colors.gold`, `colors.slateLight`, etc.

### Fonts

- Headings (web used Playfair Display / `.font-serif-display`) → `font-display`
- Body → `font-sans`, and for weights: `font-sans-medium`, `font-sans-semibold`,
  `font-sans-bold`
- Do **not** use `font-bold` / `font-semibold` — weight comes from the family
  classes above.

## Structure of the file you write

```jsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

export default function ScreenName() {
  // ...same state and effects as the web page
  return (
    <ScrollView className="flex-1 bg-cream" contentContainerClassName="p-5">
      {/* converted markup */}
    </ScrollView>
  );
}
```

- Default-export one component.
- Screen roots get `className="flex-1 bg-cream"`.
- On `ScrollView`, padding goes on `contentContainerClassName`, not `className`.
- Keep loading and empty states — render `<ActivityIndicator color={colors.gold} />`
  while loading.

## Before you finish, check

- [ ] Every string is inside a `<Text>`
- [ ] No `div`, `span`, `button`, `img`, `a`, `form` tags remain
- [ ] No `hover:` / `transition-` / `animate-` classes remain
- [ ] No `localStorage`, `window`, or `document`
- [ ] Every API path is byte-identical to the web original
- [ ] All imports use `@/`, not relative `../../src/`
- [ ] Image sources from the API go through `mediaSource()`
- [ ] The file is complete and self-contained
