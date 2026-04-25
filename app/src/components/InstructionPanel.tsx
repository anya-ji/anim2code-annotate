export function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mx-0.5">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

export default function InstructionPanel() {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-gray-700 space-y-2">
      <p className="font-medium text-gray-800 text-sm">Tips</p>
      <ul className="list-disc list-inside space-y-1.5 text-gray-600">
        <li>
          Click <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-black/40 text-white"><ExpandIcon /></span> on any video to enlarge it.
        </li>
        <li>Compare the videos but <strong>ignore the absolute position</strong> of the animated shape.</li>
        <li>Choose <strong>Left</strong> or <strong>Right</strong> whenever possible. Select <strong>Equal</strong> only when the two videos are
          exactly the same or you cannot clearly pick a better one.</li>
      </ul>
    </div>
  )
}
