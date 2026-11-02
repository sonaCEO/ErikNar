import {useLayoutEffect, useRef, useState} from "react";
import {Plus, Trash2, X} from "lucide-react";
import {Input} from "../../../components/ui/input/input";
import {Button} from "../../../components/ui/button/button";
import {Spinner} from "../../../components/ui/spinner/spinner";
import {validateImage} from "./product-form";
import p from "./products.module.css";

function moveItem(list, from, to) {
		if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
		const next = [...list];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		return next;
}

function freshPhotos(fileList) {
		const photos = [];
		for (const file of fileList) {
				validateImage(file);
				photos.push({
						key: crypto.randomUUID(),
						file,
						preview: URL.createObjectURL(file),
				});
		}
		return photos;
}

export function ColorGallery({groups, onChange, onAddPhotos, onReorderPhotos, onDeletePhoto, onDeleteGroup, onError, uploading = false}) {
		const [drag, setDrag] = useState(null);
		const [uploadPreviews, setUploadPreviews] = useState({});
		const dragRef = useRef(null);
		const frameRefs = useRef(new Map());
		const previousRects = useRef(new Map());

		useLayoutEffect(() => {
				const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
				if (!reduceMotion) {
						for (const [key, node] of frameRefs.current) {
								const previous = previousRects.current.get(key);
								if (!previous || !node.animate) continue;
								const current = node.getBoundingClientRect();
								const x = previous.left - current.left;
								const y = previous.top - current.top;
								if (x || y) {
										node.animate([
											{transform: `translate(${x}px, ${y}px)`},
											{transform: "translate(0, 0)"},
									], {duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)"});
								}
						}
				}
				previousRects.current.clear();
		}, [groups]);

		function updateGroup(key, patch) {
				onChange(groups.map((group) => group.key === key ? {...group, ...patch} : group));
		}

		function addGroup() {
				onChange([...groups, {key: crypto.randomUUID(), name: "", hex: "#20201F", panelName: "", photos: []}]);
		}

		async function addPhotos(group, fileList) {
				let photos;
				try {
						photos = freshPhotos(fileList);
				} catch (err) {
						onError?.(err);
						return;
				}
				if (!photos.length) return;
				if (onAddPhotos && group.colorId) {
					setUploadPreviews((current) => ({...current, [group.key]: [...(current[group.key] ?? []), ...photos]}));
					try {
							await onAddPhotos(group, photos);
					} catch (err) {
							onError?.(err);
					} finally {
							const keys = new Set(photos.map((photo) => photo.key));
							setUploadPreviews((current) => {
									const remaining = (current[group.key] ?? []).filter((photo) => !keys.has(photo.key));
									const next = {...current};
									if (remaining.length) next[group.key] = remaining;
									else delete next[group.key];
									return next;
							});
							for (const photo of photos) {
									if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
							}
					}
						return;
				}
				updateGroup(group.key, {photos: [...group.photos, ...photos]});
		}

		function moveDraggedPhoto(group, targetPhoto) {
				const active = dragRef.current;
				if (!active || active.groupKey !== group.key || active.overKey === targetPhoto.key) return;
				const from = group.photos.findIndex((photo) => photo.key === active.photoKey);
				const to = group.photos.findIndex((photo) => photo.key === targetPhoto.key);
				if (from < 0 || to < 0 || from === to) return;
				previousRects.current = new Map(group.photos.flatMap((photo) => {
						const node = frameRefs.current.get(photo.key);
						return node ? [[photo.key, node.getBoundingClientRect()]] : [];
				}));
				const photos = moveItem(group.photos, from, to);
				dragRef.current = {...active, overKey: targetPhoto.key, moved: true};
				setDrag(dragRef.current);
				onChange(groups.map((item) => item.key === group.key ? {...item, photos} : item));
		}

		function finishDrag(group) {
				const active = dragRef.current;
				if (active?.groupKey === group.key && active.moved && onReorderPhotos && group.colorId) {
						onReorderPhotos(group, group.photos);
				}
				dragRef.current = null;
				setDrag(null);
		}

		function removePhoto(group, photo) {
				if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
				if (photo.mediaId && onDeletePhoto) {
						onDeletePhoto(group, photo);
						return;
				}
				updateGroup(group.key, {photos: group.photos.filter((item) => item.key !== photo.key)});
		}

		function removeGroup(group) {
				for (const photo of group.photos) {
						if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
				}
				if (onDeleteGroup) onDeleteGroup(group);
				else onChange(groups.filter((item) => item.key !== group.key));
		}

		return (
				<div className={p.colorList}>
						<div className={p.colorToolbar}>
								<Button
									type="button"
									size="compact"
									variant="ginger"
									onClick={addGroup}
								>
									<Plus size={13} /> Добавить цвет
								</Button>
						</div>
						{groups.map((group) => (
								<section key={group.key} className={p.colorBlock}>
										<div className={p.colorHead}>
												<Input
														compact
														label="Цвет"
														maxLength={120}
														value={group.name}
														placeholder="Чёрный"
														onChange={(event) => updateGroup(group.key, {name: event.target.value})}
												/>
												<Input
													compact
													label="Цвет панели"
													maxLength={120}
													required
													value={group.panelName || ""}
													placeholder="Чёрный"
													onChange={(event) => updateGroup(group.key, {panelName: event.target.value})}
												/>
												<input
														className={p.hue}
														type="color"
														aria-label={`Оттенок ${group.name || "цвета"}`}
														value={group.hex || "#20201F"}
														onChange={(event) => updateGroup(group.key, {hex: event.target.value})}
												/>
												{(groups.length > 1 || !group.colorId) && (
													<Button type="button" size="compact" variant="soft" className={p.deleteButton} onClick={() => removeGroup(group)}>
																<Trash2 size={14} /> Удалить
														</Button>
												)}
										</div>
										<div
												className={p.film}
												onDragOver={(event) => event.preventDefault()}
												onDrop={(event) => {
														event.preventDefault();
														if (event.dataTransfer.files?.length) addPhotos(group, event.dataTransfer.files);
												}}
										>
						{group.photos.map((photo) => (
											<div
												key={photo.key}
												ref={(node) => {
													if (node) frameRefs.current.set(photo.key, node);
													else frameRefs.current.delete(photo.key);
												}}
												className={drag?.key === photo.key ? p.frameDragging : p.frame}
												aria-busy={uploading && photo.file ? "true" : undefined}
												onDrop={(event) => {
													event.preventDefault();
													event.stopPropagation();
													if (event.dataTransfer.files?.length) addPhotos(group, event.dataTransfer.files);
												}}
												onDragOver={(event) => {
													event.preventDefault();
													moveDraggedPhoto(group, photo);
												}}
											>
												<img
													className={p.framePreview}
													src={photo.preview}
													alt={group.name || "Фото цвета"}
													draggable
													onDragStart={(event) => {
														event.dataTransfer.effectAllowed = "move";
															dragRef.current = {photoKey: photo.key, groupKey: group.key, overKey: null, moved: false};
															setDrag(dragRef.current);
														}}
													onDragEnd={() => finishDrag(group)}
												/>
												<button type="button" className={p.shotRemove} aria-label="Убрать фото" onClick={() => removePhoto(group, photo)}>
													<X size={14} />
												</button>
												{uploading && photo.file && (
													<div className={p.uploadOverlay} role="status">
														<Spinner size={20} />
														<span>Загружаем</span>
													</div>
													)}
											</div>
										))}
											{(uploadPreviews[group.key] ?? []).map((photo) => (
												<div key={photo.key} className={p.frame} aria-busy="true">
													<img className={p.framePreview} src={photo.preview} alt={group.name || "Загружаем фото"} />
													<div className={p.uploadOverlay} role="status">
														<Spinner size={20} />
														<span>Загружаем</span>
													</div>
												</div>
											))}
													<label className={p.addFrame}>
														<Plus size={16} />
														<span>Добавить фото</span>
														<small>или перетащите сюда</small>
														<input
																type="file"
																accept="image/jpeg,image/png,image/webp"
																multiple
																hidden
																onChange={(event) => {
																		addPhotos(group, event.target.files);
																		event.target.value = "";
																}}
														/>
												</label>
										</div>
								</section>
						))}
				</div>
		);
}
