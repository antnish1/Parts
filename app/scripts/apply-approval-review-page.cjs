const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'approvals', 'ApprovalsPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

function replaceOnce(from, to) {
  if (!content.includes(from)) return;
  content = content.replace(from, to);
}

replaceOnce("import { Link } from 'react-router-dom';", "import { Link, useParams } from 'react-router-dom';");

replaceOnce(
  "  const { role, profile } = useAuth();\n",
  "  const { role, profile } = useAuth();\n  const { reviewOrderId } = useParams();\n  const isReviewPage = !!reviewOrderId;\n"
);

replaceOnce(
  "  const [reviewId, setReviewId] = useState('');",
  "  const [inlineReviewId, setInlineReviewId] = useState('');\n  const reviewId = reviewOrderId || inlineReviewId;\n  const setReviewId = setInlineReviewId;"
);

replaceOnce(
  "      if (action === 'approveOriginal') setReviewId('');",
  "      if (action === 'approveOriginal') {\n        if (isReviewPage) window.location.href = '/approvals/pending';\n        else setReviewId('');\n      }"
);

replaceOnce(
  "      <BlockingActionOverlay show={isBlockingAction} label={blockingLabel} />\n\n      <div className=\"mb-3 grid grid-cols-2 gap-2 md:grid-cols-4\">",
  "      <BlockingActionOverlay show={isBlockingAction} label={blockingLabel} />\n\n      {!isReviewPage ? (\n        <>\n      <div className=\"mb-3 grid grid-cols-2 gap-2 md:grid-cols-4\">"
);

replaceOnce(
  "      {reviewId ? (\n        <div className=\"mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3\">",
  "        </>\n      ) : null}\n\n      {reviewId ? (\n        <div className={isReviewPage ? 'rounded-lg border border-[#263244] bg-[#0b1020] p-3' : 'mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3'}>"
);

replaceOnce(
  "                        onClick={() => setReviewId(order.id)}\n                      >\n                        Review\n                      </button>",
  "                      >\n                        <Link to={`/approvals/review/${order.id}`}>Review</Link>\n                      </button>"
);

replaceOnce(
  "              onClick={() => setReviewId('')}\n            >\n              Close",
  "              onClick={() => isReviewPage ? window.history.back() : setReviewId('')}\n            >\n              {isReviewPage ? 'Back to Queue' : 'Close'}"
);

fs.writeFileSync(filePath, content, 'utf8');
