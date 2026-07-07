const fs = require('fs');
const path = require('path');

const folder = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch');
const signaturePath = path.join(folder, 'SignaturePad.tsx');
if (fs.existsSync(signaturePath)) {
  let content = fs.readFileSync(signaturePath, 'utf8');
  content = content.replace("import { useEffect, useRef, useState } from 'react';", "import { useEffect, useRef, useState, type PointerEvent } from 'react';");
  content = content.split('React.PointerEvent<HTMLCanvasElement>').join('PointerEvent<HTMLCanvasElement>');
  fs.writeFileSync(signaturePath, content);
}

const formPath = path.join(folder, 'NewCreditDispatchPage.tsx');
if (fs.existsSync(formPath)) {
  let content = fs.readFileSync(formPath, 'utf8');
  content = content.replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useState, type ReactNode } from 'react';");
  content = content.split('React.ReactNode').join('ReactNode');
  fs.writeFileSync(formPath, content);
}
