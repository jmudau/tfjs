/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {ENGINE, ForwardFunc} from '../engine';
import {FusedBatchNorm, FusedBatchNormAttrs, FusedBatchNormInputs} from '../kernel_names';
import {NamedAttrMap} from '../kernel_registry';
import {Tensor, Tensor1D, Tensor4D} from '../tensor';
import {NamedTensorMap} from '../tensor_types';
import {convertToTensor} from '../tensor_util_env';
import {Rank, TensorLike} from '../types';
import * as util from '../util';

import {warnDeprecation, xAs4D} from './batchnorm_util';
import {op} from './operation';

/**
 * @deprecated Please use `tf.batchNorm` instead and note the positional
 *     argument change of scale, offset, and varianceEpsilon.
 */
function batchNormalization_<R extends Rank>(
    x: Tensor<R>|TensorLike, mean: Tensor<R>|Tensor1D|TensorLike,
    variance: Tensor<R>|Tensor1D|TensorLike, varianceEpsilon = .001,
    scale?: Tensor<R>|Tensor1D|TensorLike,
    offset?: Tensor<R>|Tensor1D|TensorLike): Tensor<R> {
  warnDeprecation();
  return batchNorm_(x, mean, variance, offset, scale, varianceEpsilon);
}

/**
 * Batch normalization.
 *
 * As described in
 * [http://arxiv.org/abs/1502.03167](http://arxiv.org/abs/1502.03167).
 *
 * Mean, variance, scale, and offset can be of two shapes:
 *   - The same shape as the input.
 *   - In the common case, the depth dimension is the last dimension of x, so
 *     the values would be an `tf.Tensor1D` of shape [depth].
 *
 * Also available are stricter rank-specific methods with the same signature
 * as this method that assert that parameters passed are of given rank
 *   - `tf.batchNorm2d`
 *   - `tf.batchNorm3d`
 *   - `tf.batchNorm4d`
 *
 * @param x The input Tensor.
 * @param mean A mean Tensor.
 * @param variance A variance Tensor.
 * @param offset An offset Tensor.
 * @param scale A scale Tensor.
 * @param varianceEpsilon A small float number to avoid dividing by 0.
 */
/** @doc {heading: 'Operations', subheading: 'Normalization'} */
function batchNorm_<R extends Rank>(
    x: Tensor<R>|TensorLike, mean: Tensor<R>|Tensor1D|TensorLike,
    variance: Tensor<R>|Tensor1D|TensorLike,
    offset?: Tensor<R>|Tensor1D|TensorLike,
    scale?: Tensor<R>|Tensor1D|TensorLike,
    varianceEpsilon?: number): Tensor<R> {
  if (varianceEpsilon == null) {
    varianceEpsilon = 0.001;
  }
  const $x = convertToTensor(x, 'x', 'batchNorm');
  const $mean = convertToTensor(mean, 'mean', 'batchNorm');
  const $variance = convertToTensor(variance, 'variance', 'batchNorm');
  let $scale: Tensor<R>|Tensor1D;
  if (scale != null) {
    $scale = convertToTensor(scale, 'scale', 'batchNorm');
  }
  let $offset: Tensor<R>|Tensor1D;
  if (offset != null) {
    $offset = convertToTensor(offset, 'offset', 'batchNorm');
  }

  util.assert(
      $mean.rank === $variance.rank,
      () => 'Batch normalization gradient requires mean and variance to have ' +
          'equal ranks.');
  util.assert(
      $offset == null || $mean.rank === $offset.rank,
      () => 'Batch normalization gradient requires mean and offset to have ' +
          'equal ranks.');
  util.assert(
      $scale == null || $mean.rank === $scale.rank,
      () => 'Batch normalization gradient requires mean and scale to have ' +
          'equal ranks.');

  const forward: ForwardFunc<Tensor> = (backend, save) => {
    const x4D: Tensor4D = xAs4D($x);

    const res = backend.batchNormalization(
        x4D, as1DOr4D($mean), as1DOr4D($variance), varianceEpsilon,
        as1DOr4D($scale), as1DOr4D($offset));

    save([$x, $mean, $variance, $scale]);

    return res;
  };

  const inputs: FusedBatchNormInputs =
      {x: $x, scale: $scale, offset: $offset, mean: $mean, variance: $variance};

  const attrs: FusedBatchNormAttrs = {varianceEpsilon};

  const res = ENGINE.runKernelFunc(
      forward, inputs as {} as NamedTensorMap, null /* gradient */,
      FusedBatchNorm, attrs as {} as NamedAttrMap);

  return res.reshape($x.shape);
}

function as1DOr4D(x: Tensor): Tensor4D|Tensor1D {
  if (x == null) {
    return null;
  }
  if (x.rank === 0) {
    return x.as1D();
  } else if (x.rank === 1) {
    return x as Tensor1D;
  } else if (x.rank === 2) {
    return x.as4D(1, 1, x.shape[0], x.shape[1]);
  } else if (x.rank === 3) {
    return x.as4D(1, x.shape[0], x.shape[1], x.shape[2]);
  }
  return x as Tensor4D;
}

// todo(yassogba): Remove batchNormalization since it is deprecated.
export const batchNormalization = op({batchNormalization_});
export const batchNorm = op({batchNorm_});
