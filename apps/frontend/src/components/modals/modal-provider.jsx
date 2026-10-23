import {useState} from "react";
import {ModalContext} from "./modal-context";
import {ConsultationModal} from "./consultation/consultation-modal";
import {DetailsModal} from "./details/details-modal";
import {ProductModal} from "./product/product-modal";

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

						{modal?.type === "product" && modal.props.product && (
								<ProductModal
										open={modal.open}
										onClose={closeModal}
										onExited={handleExited}
										product={modal.props.product}
										initialVariantId={modal.props.initialVariantId}
										relatedProducts={modal.props.relatedProducts}
										onConsult={(context) => openModal("consultation", context)}
										onOpenProduct={(nextProduct) => openModal("product", {
												product: nextProduct,
												relatedProducts: [modal.props.product, ...(modal.props.relatedProducts ?? [])].filter((item) => item.id !== nextProduct.id),
										})}
								/>
						)}
				</ModalContext>
		);
}
