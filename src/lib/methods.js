import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/storage';
import sortBy from 'sort-by';
import { CREATE } from 'react-admin';

const getImageSize = file => {
  return new Promise(resolve => {
    const img = document.createElement('img');
    img.onload = function() {
      resolve({
        width: this.width,
        height: this.height
      });
    };
    img.src = file.src;
  });
};

const upload = async (fieldName, submitedData, id, resourceName, resourcePath) => {
  const file = submitedData[fieldName];
  const result = {};
  if (file) {
    const rawFile = file.rawFile;
    if (rawFile && rawFile.name) {
      const path = `${resourcePath}/${id}/${fieldName}`;
      const ref = firebase
        .storage()
        .ref()
        .child(path);
      const snapshot = await ref.put(rawFile);
      result[fieldName] = [{}];
      result[fieldName][0].uploadedAt = new Date();

      const downloadURL = await snapshot.ref.getDownloadURL();
      result[fieldName][0].src = downloadURL.split('?').shift() + '?alt=media';
      result[fieldName][0].type = rawFile.type;
      if (rawFile.type.indexOf('image/') === 0) {
        try {
          const imageSize = await getImageSize(file);
          result[fieldName][0].width = imageSize.width;
          result[fieldName][0].height = imageSize.height;
        } catch (e) {
          console.error(`Failed to get image dimensions`);
        }
      }
      return result;
    }
  }
  return false;
};

const save = async (
  id,
  data,
  previous,
  resourceName,
  resourcePath,
  firebaseSaveFilter,
  uploadResults,
  isNew,
  timestampFieldNames
) => {
  if (uploadResults) {
    uploadResults.map(uploadResult => (uploadResult ? Object.assign(data, uploadResult) : false));
  }

  if (isNew) {
    Object.assign(data, { [timestampFieldNames.createdAt]: new Date() });
  }

  data = Object.assign(previous, { [timestampFieldNames.updatedAt]: new Date() }, data);

  if (!data.id) {
    data.id = id;
  }

  await firebase
    .firestore()
    .doc(`${resourcePath}/${data.id}`)
    .set(firebaseSaveFilter(data));
  return { data };
};

const del = async (id, resourceName, resourcePath, uploadFields) => {
  if (uploadFields.length) {
    uploadFields.map(fieldName =>
      firebase
        .storage()
        .ref()
        .child(`${resourcePath}/${id}/${fieldName}`)
        .delete()
    );
  }

  await firebase
    .firestore()
    .doc(`${resourcePath}/${id}`)
    .delete();
  return { data: id };
};

const delMany = async (ids, resourceName, previousData) => {
  await ids.map(id =>
    firebase
      .firestore()
      .doc(`${resourceName}/${id}`)
      .delete()
  );
  return { data: ids };
};

const getItemID = (params, type, resourceName, resourcePath, resourceData) => {
  let itemId = params.data.id || params.id || params.data.key || params.key;
  if (!itemId) {
    itemId = firebase
      .firestore()
      .collection(resourcePath)
      .doc().id;
  }

  if (!itemId) {
    throw new Error('ID is required');
  }

  if (resourceData && resourceData[itemId] && type === CREATE) {
    throw new Error('ID already in use');
  }

  return itemId;
};

const getOne = async (params, resourceName, resourceData) => {
  if (params.id) {
    let result = await firebase
      .firestore()
      .collection(resourceName)
      .doc(params.id)
      .get();

    if (result.exists) {
      const data = result.data();

      if (data && data.id == null) {
        data['id'] = result.id;
      }
      return { data: data };
    } else {
      throw new Error('Id not found');
    }
  } else {
    throw new Error('Id not found');
  }
};

/**
 * params example:
 * pagination: { page: 1, perPage: 5 },
 * sort: { field: 'title', order: 'ASC' },
 * filter: { author_id: 12 }
 */
const compare = (item, key, filterKey) => {
  const comparison = filterKey.includes('<') || filterKey.includes('>');
  let comparisonValue = 0;
  let comparisonChecker = comparison ? (filterKey.includes('<') ? '<' : '>') : false;
  if (comparison) {
    comparisonValue = !isNaN(Number(filterKey.slice(1))) ? Number(filterKey.slice(1)) : 0;
  }
  // eslint-disable-next-line eqeqeq
  if (comparisonChecker == '>') {
    return item[key] > comparisonValue;
    // eslint-disable-next-line eqeqeq
  } else if (comparisonChecker == '<') {
    return item[key] < comparisonValue;
  } else {
    // eslint-disable-next-line eqeqeq
    return item[key].includes(filterKey);
  }
};

const itemFilter = (item, params) => {
  let meetsFilters = true;
  for (const key of Object.keys(params.filter)) {
    const filterKey = params.filter[key];
    if (typeof filterKey === 'object') {
      meetsFilters = itemFilter(item[key], { filter: filterKey });
    } else {
      meetsFilters = compare(item, key, filterKey);
    }
  }
  return meetsFilters;
};

const getList = async (params, resourceName, resourceData) => {
  if (params.pagination) {
    let values = [];
    let snapshots = params.sort
      ? await firebase
          .firestore()
          .collection(resourceName)
          .orderBy(params.sort.field, params.sort.order.toLowerCase())
          .get()
      : await firebase
          .firestore()
          .collection(resourceName)
          .get();

    for (const snapshot of snapshots.docs) {
      const data = snapshot.data();
      if (data && data.id == null) {
        data['id'] = snapshot.id;
      }
      values.push(data);
    }

    if (params.filter) {
      values = values.filter(item => itemFilter(item, params));
    }

    if (params.sort) {
      values.sort(sortBy(`${params.sort.order === 'ASC' ? '-' : ''}${params.sort.field}`));
    }

    const keys = values.map(i => i.id);
    const { page, perPage } = params.pagination;
    const _start = (page - 1) * perPage;
    const _end = page * perPage;
    const data = values ? values.slice(_start, _end) : [];
    const ids = keys.slice(_start, _end) || [];
    const total = values ? values.length : 0;
    return { data, ids, total };
  } else {
    throw new Error('Error processing request');
  }
};

const getMany = async (params, resourceName, resourceData) => {
  let data = [];
  /* eslint-disable no-await-in-loop */
  for (const id of params.ids) {
    let { data: item } = await getOne({ id }, resourceName, resourceData);
    data.push(item);
  }
  return { data };
};

const getManyReference = async (params, resourceName, resourceData) => {
  if (params.target) {
    if (!params.filter) params.filter = {};
    params.filter[params.target] = params.id;
    let { data, total } = await getList(params, resourceName, resourceData);
    return { data, total };
  } else {
    throw new Error('Error processing request');
  }
};

export default {
  upload,
  save,
  del,
  delMany,
  getItemID,
  getOne,
  getList,
  getMany,
  getManyReference
};
