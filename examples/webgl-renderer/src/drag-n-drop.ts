export function dropZone(id: string, cb: (file: File) => any) {
  const dropTarget = document.getElementById(id)
  dropTarget.ondragover = (evt) => {
    // Prevent file from being opened
    evt.preventDefault()
    dropTarget.classList.add('active')
  }
  dropTarget.ondragleave = () => {
    dropTarget.classList.remove('active')
  }
  dropTarget.ondrop = (evt) => {
    // Prevent file from being opened
    evt.preventDefault()
    dropTarget.classList.remove('active')

    const item: DataTransferItem = evt.dataTransfer.items[0]
    if (item.kind !== 'file') {
      return
    }
    cb(item.getAsFile())
  }
  dropTarget.onclick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => input.files.length && cb(input.files[0])
    input.click()
  }
}
