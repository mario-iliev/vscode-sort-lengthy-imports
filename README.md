# Opinionated sorting for imports by length and context

This extension will work on file save.
It will transform this:

```js
import React from "react";
import css from "./styles.css";
import cn from "classnames";
import Text from "./Text";
import { MyFancyComponent } from "../common/MyFancyComponent";
import styled, { createGlobalStyle } from "styled-components";
```

Into this:

```js
import styled, { createGlobalStyle } from "styled-components";
import cn from "classnames";
import React from "react";

import { MyFancyComponent } from "../common/MyFancyComponent";
import css from "./styles.css";
import Text from "./Text";
```
