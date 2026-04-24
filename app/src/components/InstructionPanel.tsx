export default function InstructionPanel() {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-gray-700 space-y-2">
      <p className="font-medium text-gray-800 text-sm">Tips</p>
      <ul className="list-disc list-inside space-y-1.5 text-gray-600">
        <li>Compare the videos but <strong>ignore the absolute position</strong> of the animated shape.</li>
        <li>Choose <strong>Left</strong> or <strong>Right</strong> whenever possible. Select <strong>Equal</strong> only when the two videos are
        exactly the same or you cannot clearly pick a better one.</li> 
        <li>
          <strong>Appearance:</strong> ONLY focus on shape, color, and style —
          NOT motion or position.
        </li>
        <li>
          <strong>Motion:</strong> ONLY focus on movement path and speed —
          NOT appearance or position.
        </li>
      </ul>
    </div>
  )
}
