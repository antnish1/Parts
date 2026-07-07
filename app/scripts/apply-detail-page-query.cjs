const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'CreditDispatchDetailPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');
content = content.replace("import { Link, useParams } from 'react-router-dom';", "import { Link, useSearchParams } from 'react-router-dom';");
content = content.replace('  const { dispatchId } = useParams();', "  const [searchParams] = useSearchParams();\n  const dispatchId = searchParams.get('id') ?? '';");
content = content.replace("queryFn: () => getCreditDispatchDetail(dispatchId ?? ''),", 'queryFn: () => getCreditDispatchDetail(dispatchId),');

fs.writeFileSync(filePath, content);
