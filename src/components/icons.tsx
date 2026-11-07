import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faPen, faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'

export function SearchIcon() {
  return <FontAwesomeIcon icon={faMagnifyingGlass} />
}

export function PlusIcon() {
  return <FontAwesomeIcon icon={faPlus} />
}

export function EditIcon() {
  return <FontAwesomeIcon icon={faPen} />
}

export function TrashIcon() {
  return <FontAwesomeIcon icon={faTrash} />
}

export function CloseIcon() {
  return <FontAwesomeIcon icon={faXmark} />
}
