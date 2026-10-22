import {useState} from "react";
import {ModalContext} from "./modal-context";
import {ConsultationModal} from "./consultation/consultation-modal";
import {DetailsModal} from "./details/details-modal";

export function ModalProvider({children}) {
		const [modal, setModal] = useState(null);

		function openModal(type, props = {}) {
				setModal({type, props, open: true});
		}

		function closeModal() {
				setModal((current) => (current ? {...current, open: false} : null));
		}

		function handleExited() {
				setModal(null);
		}

		return (
				<ModalContext value={{openModal, closeModal, modal}}>
						{children}

						{modal?.type === "consultation" && (
								<ConsultationModal
										open={modal.open}
										onClose={closeModal}
										onExited={handleExited}
										{...modal.props}
								/>
						)}

						{modal?.type === "details" && (
								<DetailsModal
										open={modal.open}
										onClose={closeModal}
										onExited={handleExited}
										onConsult={() => openModal("consultation")}
										{...modal.props}
								/>
						)}
				</ModalContext>
		);
}
